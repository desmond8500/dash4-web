<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError } from '@dash4/shared'
import type { Project, Quote } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/** Nouveau devis : client, projet (facultatif) et objet ; le reste se règle sur la fiche. */
const props = defineProps<{ clientId?: number | null; projectId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [quote: Quote] }>()

const auth = useAuthStore()
type ClientOption = { id: number; name: string }

const client = ref<ClientOption | null>(null)
const projectId = ref<number | null>(null)
const title = ref('')
const projects = ref<Project[]>([])
const suggestions = ref<ClientOption[]>([])
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

watch(visible, async (open) => {
  if (!open) return
  errors.value = {}
  generalError.value = null
  title.value = ''
  projectId.value = props.projectId ?? null
  client.value = null
  if (props.projectId) {
    try {
      const p = await api.projects.get(props.projectId)
      if (p.client) client.value = p.client
      title.value = p.name
    } catch {
      // à choisir
    }
  } else if (props.clientId) {
    try {
      const c = await api.clients.get(props.clientId)
      client.value = { id: c.id, name: c.name }
    } catch {
      // à choisir
    }
  }
})

// Projets du client choisi
watch(client, async (c) => {
  projects.value = []
  if (!c || typeof c !== 'object' || !auth.canAny(['projects.view', 'projects.view.own'])) return
  try {
    projects.value = (await api.projects.list({ client_id: c.id, per_page: 100 })).data
  } catch {
    projects.value = []
  }
  if (projectId.value && !projects.value.some((p) => p.id === projectId.value)) projectId.value = null
})

async function search(event: AutoCompleteCompleteEvent): Promise<void> {
  try {
    suggestions.value = (await api.clients.list({ search: event.query, per_page: 10 })).data.map((c) => ({ id: c.id, name: c.name }))
  } catch {
    suggestions.value = []
  }
}

async function save(): Promise<void> {
  const c = client.value && typeof client.value === 'object' ? client.value : null
  errors.value = {}
  if (!c) {
    errors.value = { client_id: ['Choisissez le client du devis.'] }
    return
  }
  saving.value = true
  try {
    const quote = await api.quotes.create({
      client_id: c.id,
      project_id: projectId.value,
      title: title.value.trim(),
      client_uuid: crypto.randomUUID(),
    })
    visible.value = false
    emit('created', quote)
  } catch (e) {
    if (e instanceof ApiError) {
      errors.value = e.errors
      generalError.value = Object.keys(e.errors).length ? null : e.message
    } else {
      generalError.value = 'Création impossible. Réessayez.'
    }
  } finally {
    saving.value = false
  }
}

const fieldError = (f: string) => errors.value[f]?.[0]
</script>

<template>
  <Dialog v-model:visible="visible" header="Nouveau devis" modal :style="{ width: '560px' }" :breakpoints="{ '600px': '95vw' }">
    <form id="quote-create" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">{{ generalError }}</Message>
      <div class="form-field form-field--full">
        <label for="q-client">Client</label>
        <AutoComplete
          v-model="client"
          input-id="q-client"
          :suggestions="suggestions"
          option-label="name"
          placeholder="Rechercher un client"
          force-selection
          dropdown
          :delay="250"
          :invalid="!!fieldError('client_id')"
          @complete="search"
        />
        <small v-if="fieldError('client_id')" class="field-error">{{ fieldError('client_id') }}</small>
      </div>
      <div class="form-field form-field--full">
        <label for="q-project">Projet (facultatif)</label>
        <Select
          id="q-project"
          v-model="projectId"
          :options="[{ id: null, name: 'Aucun projet' }, ...projects]"
          option-label="name"
          option-value="id"
          filter
          :disabled="!projects.length"
          :placeholder="projects.length ? 'Choisir un projet' : 'Aucun projet pour ce client'"
          :invalid="!!fieldError('project_id')"
        />
        <small v-if="fieldError('project_id')" class="field-error">{{ fieldError('project_id') }}</small>
      </div>
      <div class="form-field form-field--full">
        <label for="q-title">Objet</label>
        <InputText id="q-title" v-model="title" placeholder="Ex. : Installation de vidéosurveillance" :invalid="!!fieldError('title')" />
        <small v-if="fieldError('title')" class="field-error">{{ fieldError('title') }}</small>
      </div>
      <p class="form-field--full muted hint">Numéro, taxe par défaut, validité de 30 jours et compte bancaire sont remplis automatiquement.</p>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Créer le devis" icon="pi pi-check" type="submit" form="quote-create" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.hint {
  margin: 0;
  font-size: 0.85rem;
}
</style>
