<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Chip from 'primevue/chip'
import Select from 'primevue/select'
import { ApiError } from '@dash4/shared'
import type { Quote, QuoteEmailDraft } from '@dash4/shared'
import { api } from '@/services/api'
import { parseEmails } from '@/utils/quotes'

/** Envoi du devis par e-mail : destinataires choisis, PDF joint (et proposition technique). */
const props = defineProps<{ quote: Quote }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sent: [quote: Quote] }>()

const draft = ref<QuoteEmailDraft | null>(null)
const to = ref<string[]>([])
const cc = ref<string[]>([])
const toInput = ref('')
const ccInput = ref('')
const subject = ref('')
const message = ref('')
const attachProposal = ref(false)
const signatureId = ref<number | null>(null)
const signatureOptions = computed(() => [
  { id: null, name: 'Sans signature' },
  ...(draft.value?.signatures ?? []).map((s) => ({ id: s.id, name: s.shared ? `${s.name} (entreprise)` : s.name })),
])
const selectedSignature = computed(() => draft.value?.signatures.find((s) => s.id === signatureId.value) ?? null)
const signaturePreview = computed(() => selectedSignature.value?.preview ?? null)
const error = ref<string | null>(null)
const sending = ref(false)

const hasProposal = computed(() => (props.quote.sections ?? []).some((s) => s.is_visible && s.proposal?.trim()))

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  to.value = []
  cc.value = []
  attachProposal.value = hasProposal.value
  try {
    draft.value = await api.quotes.emailDraft(props.quote.id)
    subject.value = draft.value.subject
    message.value = draft.value.message
    signatureId.value = draft.value.default_signature_id
    if (draft.value.suggestions[0]) to.value = [draft.value.suggestions[0].email]
  } catch (e) {
    error.value = (e as Error).message
  }
})

function addFrom(input: typeof toInput, list: typeof to): void {
  const { valid, invalid } = parseEmails(input.value)
  list.value = [...new Set([...list.value, ...valid])]
  input.value = invalid.join(', ')
  error.value = invalid.length ? `Adresse invalide : ${invalid.join(', ')}` : null
}

const addTo = () => addFrom(toInput, to)
const addCc = () => addFrom(ccInput, cc)

function toggleSuggestion(email: string): void {
  to.value = to.value.includes(email) ? to.value.filter((e) => e !== email) : [...to.value, email]
}

async function send(): Promise<void> {
  addTo()
  addCc()
  if (error.value) return
  if (!to.value.length) {
    error.value = 'Indiquez au moins un destinataire.'
    return
  }
  sending.value = true
  try {
    const quote = await api.quotes.send(props.quote.id, {
      to: to.value,
      cc: cc.value,
      subject: subject.value.trim(),
      message: message.value,
      attach_proposal: attachProposal.value,
      signature_id: signatureId.value,
    })
    visible.value = false
    emit('sent', quote)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="`Envoyer le devis ${props.quote.number}`" modal :style="{ width: '640px' }" :breakpoints="{ '700px': '95vw' }">
    <form id="quote-email" class="form-grid" @submit.prevent="send">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>

      <div v-if="draft?.suggestions.length" class="form-field form-field--full">
        <label>Adresses connues</label>
        <div class="suggestions">
          <label v-for="s in draft.suggestions" :key="s.email" class="suggestion">
            <Checkbox :model-value="to.includes(s.email)" binary @update:model-value="toggleSuggestion(s.email)" />
            <span>{{ s.name }} <span class="muted">&lt;{{ s.email }}&gt;<template v-if="s.label"> · {{ s.label }}</template></span></span>
          </label>
        </div>
      </div>

      <div class="form-field form-field--full">
        <label for="e-to">Destinataires</label>
        <div class="chips">
          <Chip v-for="email in to" :key="email" :label="email" removable @remove="to = to.filter((e) => e !== email)" />
        </div>
        <InputText id="e-to" v-model="toInput" placeholder="Autre adresse, puis Entrée (plusieurs : séparées par des virgules)" @keydown.enter.prevent="addTo" @blur="addTo" />
      </div>
      <div class="form-field form-field--full">
        <label for="e-cc">Copie</label>
        <div class="chips">
          <Chip v-for="email in cc" :key="email" :label="email" removable @remove="cc = cc.filter((e) => e !== email)" />
        </div>
        <InputText id="e-cc" v-model="ccInput" placeholder="Facultatif" @keydown.enter.prevent="addCc" @blur="addCc" />
      </div>
      <div class="form-field form-field--full">
        <label for="e-subject">Objet</label>
        <InputText id="e-subject" v-model="subject" />
      </div>
      <div class="form-field form-field--full">
        <label for="e-message">Message</label>
        <Textarea id="e-message" v-model="message" rows="8" auto-resize />
      </div>
      <div class="form-field form-field--full">
        <label for="e-signature">Signature</label>
        <Select id="e-signature" v-model="signatureId" :options="signatureOptions" option-label="name" option-value="id" />
        <div v-if="selectedSignature" class="signature">
          <pre>{{ signaturePreview }}</pre>
          <img v-if="selectedSignature.image_url" :src="selectedSignature.image_url" :style="{ width: `${Math.min(selectedSignature.image_width, 300)}px` }" alt="" />
        </div>
        <small class="muted">
          Vos signatures se gèrent dans <RouterLink :to="{ name: 'profile' }" @click="visible = false">Mon profil</RouterLink>.
        </small>
      </div>
      <div class="form-field form-field--full">
        <span class="muted"><i class="pi pi-paperclip" /> {{ props.quote.number }}.pdf</span>
        <label class="suggestion">
          <Checkbox v-model="attachProposal" binary :disabled="!hasProposal" />
          Joindre aussi la proposition technique<span v-if="!hasProposal" class="muted"> (aucun texte de proposition)</span>
        </label>
        <small class="muted">Les réponses du client arriveront sur votre adresse. Un brouillon passe à « Envoyé ».</small>
      </div>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Envoyer" icon="pi pi-send" type="submit" form="quote-email" :loading="sending" />
    </template>
  </Dialog>
</template>

<style scoped>
.signature {
  margin: 0.25rem 0 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--p-content-border-color);
}

.signature pre {
  margin: 0;
  font-family: inherit;
  font-size: 0.85rem;
  white-space: pre-wrap;
  color: var(--p-text-muted-color);
}

.signature img {
  display: block;
  margin-top: 0.5rem;
  max-width: 100%;
  height: auto;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.suggestion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
</style>
