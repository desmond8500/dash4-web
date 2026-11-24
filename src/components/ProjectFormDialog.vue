<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, PROJECT_STATUS_LABELS } from '@dash4/shared'
import type { Assignee, Project, ProjectPayload, ProjectStatus } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { fromApiDate, toApiDate } from '@/utils/projects'
import ClientPicker, { type ClientOption } from '@/components/ClientPicker.vue'

/** Création (project = null) ou modification d'un projet. `clientId` pré-remplit le client. */
const props = defineProps<{ project: Project | null; clientId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [project: Project] }>()

const auth = useAuthStore()
const isEdit = computed(() => props.project !== null)

const form = reactive({
  name: '',
  client: null as ClientOption | null,
  status: 'in_progress' as ProjectStatus,
  manager_id: null as number | null,
  start: null as Date | null,
  end: null as Date | null,
  address: '',
  latitude: null as number | null,
  longitude: null as number | null,
  description: '',
  is_favorite: false,
})
const assignees = ref<Assignee[]>([])
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

const statusOptions = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const managerOptions = computed(() => [
  { value: null, label: 'Aucun' },
  ...assignees.value
    .filter((a) => a.account_type === 'manager')
    .map((a) => ({ value: a.id, label: a.id === auth.user?.id ? `${a.full_name} (moi)` : a.full_name })),
])

watch(visible, async (open) => {
  if (!open) return
  errors.value = {}
  generalError.value = null
  const p = props.project
  Object.assign(form, {
    name: p?.name ?? '',
    client: p?.client ?? null,
    status: p?.status.value ?? 'in_progress',
    manager_id: p?.manager_id ?? null,
    start: fromApiDate(p?.start_date ?? null),
    end: fromApiDate(p?.end_date ?? null),
    address: p?.address ?? '',
    latitude: p?.latitude ?? null,
    longitude: p?.longitude ?? null,
    description: p?.description ?? '',
    is_favorite: p?.is_favorite ?? false,
  })
  if (!p && props.clientId) {
    try {
      const c = await api.clients.get(props.clientId)
      form.client = { id: c.id, name: c.name }
    } catch {
      // à choisir
    }
  }
  if (assignees.value.length === 0) {
    try {
      assignees.value = await api.assignees.list()
    } catch {
      // liste facultative (le chef de projet reste « Aucun »)
    }
  }
})

function fieldError(field: string): string | undefined {
  return errors.value[field]?.[0]
}

/** Position actuelle du navigateur (sur place, sur le chantier). */
function locate(): void {
  navigator.geolocation?.getCurrentPosition(
    (pos) => {
      form.latitude = Math.round(pos.coords.latitude * 1e7) / 1e7
      form.longitude = Math.round(pos.coords.longitude * 1e7) / 1e7
    },
    () => (generalError.value = 'Position introuvable : autorisez la localisation dans le navigateur.'),
  )
}

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  generalError.value = null

  const client = form.client && typeof form.client === 'object' ? form.client : null
  const payload: ProjectPayload = {
    name: form.name.trim(),
    client_id: client?.id ?? 0,
    status: form.status,
    manager_id: form.manager_id,
    start_date: toApiDate(form.start),
    end_date: toApiDate(form.end),
    address: form.address.trim() || null,
    latitude: form.latitude,
    longitude: form.longitude,
    description: form.description.trim() || null,
    is_favorite: form.is_favorite,
  }
  if (!client) {
    errors.value = { client_id: ['Choisissez le client du projet.'] }
    saving.value = false
    return
  }

  try {
    const saved = props.project
      ? await api.projects.update(props.project.id, payload)
      : await api.projects.create({ ...payload, client_uuid: crypto.randomUUID() })
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    if (e instanceof ApiError) {
      errors.value = e.errors
      generalError.value = Object.keys(e.errors).length ? null : e.message
    } else {
      generalError.value = 'Enregistrement impossible. Réessayez.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="isEdit ? 'Modifier le projet' : 'Nouveau projet'"
    modal
    :style="{ width: '720px' }"
    :breakpoints="{ '780px': '95vw' }"
  >
    <form id="project-form" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">
        {{ generalError }}
      </Message>

      <div class="form-field form-field--full">
        <label for="project-name">Nom du projet</label>
        <InputText id="project-name" v-model="form.name" :invalid="!!fieldError('name')" required autofocus />
        <small v-if="fieldError('name')" class="field-error">{{ fieldError('name') }}</small>
      </div>

      <div class="form-field">
        <label for="project-client">Client</label>
        <ClientPicker v-model="form.client" input-id="project-client" :invalid="!!fieldError('client_id')" />
        <small v-if="fieldError('client_id')" class="field-error">{{ fieldError('client_id') }}</small>
      </div>

      <div class="form-field">
        <label for="project-status">Statut</label>
        <Select id="project-status" v-model="form.status" :options="statusOptions" option-label="label" option-value="value" />
      </div>

      <div class="form-field">
        <label for="project-manager">Chef de projet</label>
        <Select
          id="project-manager"
          v-model="form.manager_id"
          :options="managerOptions"
          option-label="label"
          option-value="value"
          filter
          :invalid="!!fieldError('manager_id')"
        />
      </div>

      <div class="form-field dates">
        <div>
          <label for="project-start">Début</label>
          <DatePicker v-model="form.start" input-id="project-start" date-format="dd/mm/yy" show-button-bar />
        </div>
        <div>
          <label for="project-end">Fin prévue</label>
          <DatePicker
            v-model="form.end"
            input-id="project-end"
            date-format="dd/mm/yy"
            show-button-bar
            :min-date="form.start ?? undefined"
            :invalid="!!fieldError('end_date')"
          />
        </div>
        <small v-if="fieldError('end_date')" class="field-error">{{ fieldError('end_date') }}</small>
      </div>

      <div class="form-field form-field--full">
        <label for="project-address">Adresse du chantier</label>
        <InputText id="project-address" v-model="form.address" />
      </div>

      <div class="form-field form-field--full gps">
        <div>
          <label for="project-lat">Latitude</label>
          <InputNumber
            v-model="form.latitude"
            input-id="project-lat"
            :min-fraction-digits="0"
            :max-fraction-digits="7"
            :min="-90"
            :max="90"
            locale="en-US"
            :use-grouping="false"
          />
        </div>
        <div>
          <label for="project-lng">Longitude</label>
          <InputNumber
            v-model="form.longitude"
            input-id="project-lng"
            :min-fraction-digits="0"
            :max-fraction-digits="7"
            :min="-180"
            :max="180"
            locale="en-US"
            :use-grouping="false"
          />
        </div>
        <Button label="Ma position" icon="pi pi-map-marker" severity="secondary" outlined size="small" @click="locate" />
        <small v-if="fieldError('latitude') || fieldError('longitude')" class="field-error">
          {{ fieldError('latitude') ?? fieldError('longitude') }}
        </small>
      </div>

      <div class="form-field form-field--full">
        <label for="project-description">Résumé</label>
        <MarkdownEditor id="project-description" v-model="form.description" rows="4" auto-resize />
      </div>

      <div class="form-field form-field--full switch">
        <ToggleSwitch v-model="form.is_favorite" input-id="project-favorite" />
        <label for="project-favorite">Projet favori (affiché en premier)</label>
      </div>
    </form>

    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="project-form" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.dates,
.gps {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

.dates > div,
.gps > div {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 9rem;
}

.switch {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}
</style>
