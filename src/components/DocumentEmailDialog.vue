<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Chip from 'primevue/chip'
import Select from 'primevue/select'
import { ApiError } from '@dash4/shared'
import type { QuoteEmailDraft, QuoteEmailPayload } from '@dash4/shared'
import AutoComplete, { type AutoCompleteCompleteEvent, type AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import { contactEmailOptions, parseEmails, type ContactEmailOption } from '@/utils/quotes'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Envoi d'un document par e-mail (devis, facture) : destinataires proposés, message, signature,
 * PDF joint. `proposal` : `null` cache la case « proposition technique », sinon dit si elle existe.
 */
const props = defineProps<{
  header: string
  attachments: string[]
  load: () => Promise<QuoteEmailDraft>
  submit: (payload: QuoteEmailPayload) => Promise<void>
  proposal?: boolean | null
  note?: string
}>()
const visible = defineModel<boolean>('visible', { required: true })

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
const formId = `email-${Math.random().toString(36).slice(2, 8)}`
const sending = ref(false)

const hasProposal = computed(() => props.proposal === true)

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  to.value = []
  cc.value = []
  attachProposal.value = hasProposal.value
  try {
    draft.value = await props.load()
    subject.value = draft.value.subject
    message.value = draft.value.message
    signatureId.value = draft.value.default_signature_id
    if (draft.value.suggestions[0]) to.value = [draft.value.suggestions[0].email]
  } catch (e) {
    error.value = (e as Error).message
  }
})

// Recherche dans les contacts (nom, société ou adresse) pendant la saisie d'un destinataire
const auth = useAuthStore()
const canSearchContacts = computed(() => auth.canAny(['clients.view', 'clients.view.own']))
const contactOptions = ref<ContactEmailOption[]>([])
let searchSeq = 0

async function searchContacts(event: AutoCompleteCompleteEvent, list: typeof to): Promise<void> {
  const query = event.query.trim()
  const seq = ++searchSeq
  if (query.length < 2 || !canSearchContacts.value) {
    contactOptions.value = []
    return
  }
  try {
    const result = await api.contacts.list({ search: query, per_page: 10 })
    if (seq === searchSeq) contactOptions.value = contactEmailOptions(result.data, list.value)
  } catch {
    if (seq === searchSeq) contactOptions.value = []
  }
}

function pickContact(event: AutoCompleteOptionSelectEvent, input: typeof toInput, list: typeof to): void {
  const option = event.value as ContactEmailOption
  list.value = [...new Set([...list.value, option.email])]
  input.value = ''
  error.value = null
}

/** Nom du contact pour une adresse choisie (suggestions du document ou recherche). */
const knownNames = computed(() => {
  const names = new Map<string, string>()
  for (const s of draft.value?.suggestions ?? []) names.set(s.email.toLowerCase(), s.name)
  for (const o of contactOptions.value) if (!names.has(o.email)) names.set(o.email, o.name)
  return names
})
const remembered = ref(new Map<string, string>())
watch(knownNames, (names) => {
  for (const [email, name] of names) remembered.value.set(email, name)
})
const chipLabel = (email: string) => {
  const name = remembered.value.get(email.toLowerCase())
  return name ? `${name} <${email}>` : email
}

function addFrom(input: typeof toInput, list: typeof to): void {
  if (typeof input.value !== 'string') {
    input.value = ''
    return
  }
  const { valid, invalid } = parseEmails(input.value)
  list.value = [...new Set([...list.value, ...valid])]
  input.value = invalid.join(', ')
  error.value = invalid.length ? `Adresse invalide : ${invalid.join(', ')}` : null
}

const addTo = () => addFrom(toInput, to)
/**
 * Entrée : si un contact est en surbrillance, la liste l'a déjà ajouté (et a vidé la saisie) ;
 * sinon on ajoute l'adresse tapée. Le formulaire n'est pas envoyé.
 */
function onEnter(event: KeyboardEvent, add: () => void): void {
  event.preventDefault()
  add()
}
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
    await props.submit({
      to: to.value,
      cc: cc.value,
      subject: subject.value.trim(),
      message: message.value,
      signature_id: signatureId.value,
      ...(props.proposal != null ? { attach_proposal: attachProposal.value } : {}),
    })
    visible.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.header" modal :style="{ width: '640px' }" :breakpoints="{ '700px': '95vw' }">
    <form :id="formId" class="form-grid" @submit.prevent="send">
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
          <Chip v-for="email in to" :key="email" :label="chipLabel(email)" removable @remove="to = to.filter((e) => e !== email)" />
        </div>
        <AutoComplete
          v-model="toInput"
          input-id="e-to"
          :suggestions="contactOptions"
          option-label="email"
          :delay="250"
          :min-length="2"
          fluid
          placeholder="Nom d'un contact ou adresse, puis Entrée"
          @complete="searchContacts($event, to)"
          @option-select="pickContact($event, toInput, to)"
          @keydown.enter="onEnter($event, addTo)"
          @blur="addTo"
        >
          <template #option="{ option }">
            <div class="contact-option">
              <span>{{ option.name }} <span class="muted">&lt;{{ option.email }}&gt;</span></span>
              <small v-if="option.detail" class="muted">{{ option.detail }}</small>
            </div>
          </template>
          <template #empty><span class="muted">Aucun contact trouvé : tapez l'adresse complète.</span></template>
        </AutoComplete>
      </div>
      <div class="form-field form-field--full">
        <label for="e-cc">Copie</label>
        <div class="chips">
          <Chip v-for="email in cc" :key="email" :label="chipLabel(email)" removable @remove="cc = cc.filter((e) => e !== email)" />
        </div>
        <AutoComplete
          v-model="ccInput"
          input-id="e-cc"
          :suggestions="contactOptions"
          option-label="email"
          :delay="250"
          :min-length="2"
          fluid
          placeholder="Facultatif — nom d'un contact ou adresse"
          @complete="searchContacts($event, cc)"
          @option-select="pickContact($event, ccInput, cc)"
          @keydown.enter="onEnter($event, addCc)"
          @blur="addCc"
        >
          <template #option="{ option }">
            <div class="contact-option">
              <span>{{ option.name }} <span class="muted">&lt;{{ option.email }}&gt;</span></span>
              <small v-if="option.detail" class="muted">{{ option.detail }}</small>
            </div>
          </template>
        </AutoComplete>
      </div>
      <div class="form-field form-field--full">
        <label for="e-subject">Objet</label>
        <InputText id="e-subject" v-model="subject" />
      </div>
      <div class="form-field form-field--full">
        <label for="e-message">Message</label>
        <MarkdownEditor id="e-message" v-model="message" rows="8" auto-resize />
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
        <span v-for="name in props.attachments" :key="name" class="muted"><i class="pi pi-paperclip" /> {{ name }}</span>
        <label v-if="props.proposal != null" class="suggestion">
          <Checkbox v-model="attachProposal" binary :disabled="!hasProposal" />
          Joindre aussi la proposition technique<span v-if="!hasProposal" class="muted"> (aucun texte de proposition)</span>
        </label>
        <small class="muted">Les réponses du client arriveront sur votre adresse.<template v-if="props.note"> {{ props.note }}</template></small>
      </div>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Envoyer" icon="pi pi-send" type="submit" :form="formId" :loading="sending" />
    </template>
  </Dialog>
</template>

<style scoped>
.contact-option {
  display: flex;
  flex-direction: column;
}

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
