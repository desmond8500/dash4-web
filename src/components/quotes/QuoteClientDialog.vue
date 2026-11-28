<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Message from 'primevue/message'
import { ApiError, type Quote } from '@dash4/shared'
import ClientPicker, { type ClientOption } from '@/components/ClientPicker.vue'
import { api } from '@/services/api'
import { apiErrorMessage } from '@/utils/errors'
import { quoteClientPayload } from '@/utils/quoteClient'

/**
 * Client du devis : changer de client (le projet suit s'il appartient au nouveau client),
 * et nom imprimé sur ce devis seulement (raison sociale exacte, filiale, « à l'attention de »).
 */
const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ quote: Quote }>()
const emit = defineEmits<{ saved: [quote: Quote] }>()

const client = ref<ClientOption | null>(null)
const clientName = ref('')
const projectId = ref<number | null>(null)
const projects = ref<Array<{ id: number; name: string }>>([])
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

watch(visible, (open) => {
  if (!open) return
  client.value = props.quote.client ? { id: props.quote.client.id, name: props.quote.client.name } : null
  clientName.value = props.quote.client_name ?? ''
  projectId.value = props.quote.project_id
  errors.value = {}
  generalError.value = null
})

// Projets du client choisi ; celui du devis est retiré s'il n'est pas à ce client
watch(client, async (c) => {
  projects.value = []
  if (!c || typeof c !== 'object') return
  try {
    projects.value = (await api.projects.list({ client_id: c.id, per_page: 100 })).data.map((p) => ({ id: p.id, name: p.name }))
  } catch (e) {
    generalError.value = apiErrorMessage(e)
  }
  if (projectId.value && !projects.value.some((p) => p.id === projectId.value)) projectId.value = null
})

async function save(): Promise<void> {
  const c = client.value && typeof client.value === 'object' ? client.value : null
  if (!c) {
    errors.value = { client_id: ['Choisissez le client du devis.'] }
    return
  }
  saving.value = true
  errors.value = {}
  generalError.value = null
  try {
    const payload = quoteClientPayload(props.quote, c.id, projectId.value, clientName.value, c.name)
    if (!Object.keys(payload).length) {
      visible.value = false
      return
    }
    const updated = await api.quotes.update(props.quote.id, payload)
    emit('saved', updated)
    visible.value = false
  } catch (e) {
    if (e instanceof ApiError && Object.keys(e.errors).length) errors.value = e.errors
    else generalError.value = apiErrorMessage(e, 'Modification impossible. Réessayez.')
  } finally {
    saving.value = false
  }
}

const fieldError = (f: string) => errors.value[f]?.[0]
</script>

<template>
  <Dialog v-model:visible="visible" header="Client du devis" modal :style="{ width: '540px' }" :breakpoints="{ '600px': '95vw' }">
    <form id="quote-client" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">{{ generalError }}</Message>
      <div class="form-field form-field--full">
        <label for="qc-client">Client</label>
        <ClientPicker v-model="client" input-id="qc-client" :invalid="!!fieldError('client_id')" />
        <small v-if="fieldError('client_id')" class="field-error">{{ fieldError('client_id') }}</small>
      </div>
      <div class="form-field form-field--full">
        <label for="qc-project">Projet</label>
        <Select
          id="qc-project"
          v-model="projectId"
          :options="[{ id: null, name: 'Aucun projet' }, ...projects]"
          option-label="name"
          option-value="id"
          filter
          :placeholder="projects.length ? 'Choisir un projet' : 'Aucun projet pour ce client'"
          :invalid="!!fieldError('project_id')"
        />
        <small v-if="fieldError('project_id')" class="field-error">{{ fieldError('project_id') }}</small>
      </div>
      <div class="form-field form-field--full">
        <label for="qc-name">Nom affiché sur le devis</label>
        <InputText
          id="qc-name"
          v-model="clientName"
          :placeholder="client && typeof client === 'object' ? client.name : 'Nom de la fiche client'"
          maxlength="255"
          :invalid="!!fieldError('client_name')"
        />
        <small v-if="fieldError('client_name')" class="field-error">{{ fieldError('client_name') }}</small>
        <small v-else class="muted">Imprimé sur le PDF du devis, le bon de livraison et la proposition, sans changer la fiche client. Vide : le nom de la fiche.</small>
      </div>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button type="submit" form="quote-client" label="Enregistrer" icon="pi pi-check" :loading="saving" />
    </template>
  </Dialog>
</template>
