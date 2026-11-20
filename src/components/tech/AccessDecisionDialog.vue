<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError } from '@dash4/shared'
import type { TechAccessRequest } from '@dash4/shared'
import { api } from '@/services/api'
import { defaultExpiry } from '@/utils/techSpace'

/** Accepter (en envoyant l'information, avec une expiration) ou refuser une demande d'accès. */
const props = defineProps<{ request: TechAccessRequest | null; decision: 'approved' | 'rejected' }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ decided: [request: TechAccessRequest] }>()

const response = ref('')
const withShare = ref(true)
const share = ref({ title: '', content: '', expires_at: null as Date | null })
const error = ref<string | null>(null)
const saving = ref(false)

watch(visible, (open) => {
  if (!open || !props.request) return
  error.value = null
  response.value = ''
  withShare.value = true
  const needed = props.request.needed_on ? new Date(`${props.request.needed_on}T19:00:00`) : null
  share.value = { title: props.request.subject, content: '', expires_at: needed && needed.getTime() > Date.now() ? needed : defaultExpiry() }
})

async function save(): Promise<void> {
  if (!props.request) return
  const approving = props.decision === 'approved'
  if (!approving && !response.value.trim()) return void (error.value = 'Indiquez la raison du refus.')
  if (approving && withShare.value && (!share.value.content.trim() || !share.value.expires_at)) return void (error.value = "Indiquez l'information et jusqu'à quand elle reste visible.")
  saving.value = true
  try {
    const r = await api.accessRequests.decide(props.request.id, {
      decision: props.decision,
      response: response.value.trim() || null,
      share: approving && withShare.value
        ? { title: share.value.title.trim() || null, content: share.value.content.trim(), category: 'access', expires_at: share.value.expires_at!.toISOString() }
        : null,
    })
    visible.value = false
    emit('decided', r)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.decision === 'approved' ? 'Accepter la demande' : 'Refuser la demande'" modal :style="{ width: '540px' }" :breakpoints="{ '580px': '95vw' }">
    <form v-if="props.request" id="access-decision" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <p class="form-field--full">
        <strong>{{ props.request.subject }}</strong> — {{ props.request.user?.full_name }}
        <span v-if="props.request.reason" class="muted"><br />{{ props.request.reason }}</span>
      </p>
      <div class="form-field form-field--full">
        <label for="ad-response">{{ props.decision === 'approved' ? 'Message (facultatif)' : 'Raison du refus' }}</label>
        <Textarea id="ad-response" v-model="response" rows="2" auto-resize />
      </div>
      <template v-if="props.decision === 'approved'">
        <div class="form-field form-field--full"><label class="switch"><ToggleSwitch v-model="withShare" /> Envoyer l'information au technicien</label></div>
        <template v-if="withShare">
          <div class="form-field form-field--full"><label for="ad-title">Titre</label><InputText id="ad-title" v-model="share.title" /></div>
          <div class="form-field form-field--full"><label for="ad-content">Information (code, emplacement de la clé…)</label><Textarea id="ad-content" v-model="share.content" rows="3" auto-resize /></div>
          <div class="form-field"><label for="ad-exp">Visible jusqu'au</label><DatePicker v-model="share.expires_at" input-id="ad-exp" show-time hour-format="24" date-format="dd/mm/yy" :min-date="new Date()" /></div>
        </template>
      </template>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button :label="props.decision === 'approved' ? 'Accepter' : 'Refuser'" :severity="props.decision === 'approved' ? 'success' : 'danger'" type="submit" form="access-decision" :loading="saving" />
    </template>
  </Dialog>
</template>
