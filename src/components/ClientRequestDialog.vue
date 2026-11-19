<script setup lang="ts">
import RequestLinks from '@/components/requests/RequestLinks.vue'
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import SelectButton from 'primevue/selectbutton'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'
import {
  ApiError,
  CLIENT_REQUEST_SOURCE_LABELS,
  CLIENT_REQUEST_STATUS_LABELS,
  PRIORITY_LABELS,
} from '@dash4/shared'
import type {
  Assignee,
  ClientRequest,
  ClientRequestPayload,
  ClientRequestSource,
  ClientRequestStatus,
  Priority,
} from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/clientRequests'

/**
 * Saisie express d'une demande (request = null) ou modification.
 * En saisie, seul le texte est obligatoire ; le reste est dans « Plus d'options ».
 */
const props = defineProps<{ request: ClientRequest | null; clientId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [request: ClientRequest]; converted: [target: { type: 'project' | 'quote' | 'task'; id: number }] }>()

const auth = useAuthStore()
const isEdit = computed(() => props.request !== null)
const canManage = computed(() => auth.can('client_requests.update'))

type ClientOption = { id: number; name: string }

const form = reactive({
  body: '',
  client: null as ClientOption | null,
  contact_name: '',
  contact_phone: '',
  source: 'phone' as ClientRequestSource,
  status: 'new' as ClientRequestStatus,
  priority: 'normal' as Priority,
  assigned_to: null as number | null,
  remind_at: null as Date | null,
})
const more = ref(false)
const clientSuggestions = ref<ClientOption[]>([])
const assignees = ref<Assignee[]>([])
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

const sourceOptions = Object.entries(CLIENT_REQUEST_SOURCE_LABELS).map(([value, label]) => ({ value, label }))
const priorityOptions = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))
const statusOptions = Object.entries(CLIENT_REQUEST_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const assigneeOptions = computed(() => [
  { value: null, label: 'Personne' },
  ...assignees.value.map((a) => ({ value: a.id, label: a.id === auth.user?.id ? `${a.full_name} (moi)` : a.full_name })),
])

watch(visible, async (open) => {
  if (!open) return
  errors.value = {}
  generalError.value = null
  const r = props.request
  more.value = isEdit.value
  Object.assign(form, {
    body: r?.body ?? '',
    client: r?.client ?? null,
    contact_name: r?.contact_name ?? '',
    contact_phone: r?.contact_phone ?? '',
    source: r?.source.value ?? 'phone',
    status: r?.status.value ?? 'new',
    priority: r?.priority.value ?? 'normal',
    assigned_to: r?.assigned_to ?? null,
    remind_at: r?.remind_at ? new Date(r.remind_at) : null,
  })
  if (!r && props.clientId) {
    try {
      const c = await api.clients.get(props.clientId)
      form.client = { id: c.id, name: c.name }
    } catch {
      // le client reste à choisir
    }
  }
  if (canManage.value && assignees.value.length === 0) {
    try {
      assignees.value = await api.assignees.list()
    } catch {
      // liste facultative
    }
  }
})

async function searchClients(event: AutoCompleteCompleteEvent): Promise<void> {
  if (!auth.canAny(['clients.view', 'clients.view.own'])) return
  try {
    const result = await api.clients.list({ search: event.query, per_page: 10 })
    clientSuggestions.value = result.data.map((c) => ({ id: c.id, name: c.name }))
  } catch {
    clientSuggestions.value = []
  }
}

// Transformation en projet
const convertible = computed(() => !!props.request && !props.request.converted_to && auth.can('client_requests.convert'))
const canConvert = computed(() => convertible.value && auth.can('projects.create'))
const canConvertQuote = computed(() => convertible.value && auth.can('quotes.create'))
const CONVERTED: Record<string, { label: string; route: string }> = {
  quote: { label: 'devis', route: 'quote' },
  task: { label: 'tâche', route: 'task' },
  project: { label: 'projet', route: 'project' },
}
const convertedLabel = (type: string) => CONVERTED[type]?.label ?? 'projet'
const convertedRoute = (type: string) => CONVERTED[type]?.route ?? 'project'
const canConvertTask = computed(() => convertible.value && auth.can('tasks.create'))
const convertType = ref<'project' | 'quote' | 'task'>('project')
const convertOpen = ref(false)
const convertName = ref('')
const converting = ref(false)

function openConvert(type: 'project' | 'quote' | 'task' = 'project'): void {
  convertType.value = type
  const body = props.request?.body.replace(/\s+/g, ' ').trim() ?? ''
  convertName.value = body.length > 80 ? `${body.slice(0, 79)}…` : body
  convertOpen.value = true
}

async function convert(): Promise<void> {
  if (!props.request) return
  const client = form.client && typeof form.client === 'object' ? form.client : null
  if (!client && convertType.value !== 'task') {
    errors.value = { client_id: ['Choisissez le client du projet.'] }
    convertOpen.value = false
    more.value = true
    return
  }
  converting.value = true
  try {
    const result = await api.clientRequests.convert(props.request.id, {
      type: convertType.value,
      name: convertName.value.trim() || undefined,
      client_id: client?.id,
    })
    convertOpen.value = false
    visible.value = false
    emit('saved', result.request)
    const created = result.task ?? result.quote ?? result.project
    if (created) emit('converted', { type: convertType.value, id: created.id })
  } catch (e) {
    generalError.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Transformation impossible.'
    convertOpen.value = false
  } finally {
    converting.value = false
  }
}

function fieldError(field: string): string | undefined {
  return errors.value[field]?.[0]
}

const clean = (value: string) => value.trim() || null

/** Rappel rapide : demain à 9 h. */
function remindTomorrow(): void {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  form.remind_at = d
  more.value = true
}

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  generalError.value = null

  const client = typeof form.client === 'object' ? form.client : null
  const payload: ClientRequestPayload = {
    body: form.body.trim(),
    client_id: client?.id ?? null,
    contact_name: client ? null : clean(form.contact_name),
    contact_phone: client ? null : clean(form.contact_phone),
    source: form.source,
    priority: form.priority,
  }
  if (canManage.value) {
    payload.assigned_to = form.assigned_to
    payload.remind_at = form.remind_at ? form.remind_at.toISOString() : null
    if (isEdit.value) payload.status = form.status
  }

  try {
    const saved = props.request
      ? await api.clientRequests.update(props.request.id, payload)
      : await api.clientRequests.create({ ...payload, client_uuid: crypto.randomUUID() })
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
    :header="isEdit ? 'Demande client' : 'Nouvelle demande'"
    modal
    :style="{ width: '640px' }"
    :breakpoints="{ '700px': '95vw' }"
  >
    <form id="client-request-form" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">
        {{ generalError }}
      </Message>

      <div class="form-field form-field--full">
        <label for="request-body">Demande</label>
        <Textarea
          id="request-body"
          v-model="form.body"
          rows="3"
          auto-resize
          autofocus
          placeholder="Ex. : M. Diop rappelle pour l'installation de deux caméras"
          :invalid="!!fieldError('body')"
          @keydown.ctrl.enter="save"
          @keydown.meta.enter="save"
        />
        <small v-if="fieldError('body')" class="field-error">{{ fieldError('body') }}</small>
      </div>

      <Message v-if="props.request?.converted_to" class="form-field--full" severity="success" :closable="false">
        Transformée en {{ convertedLabel(props.request.converted_to.type) }} —
        <RouterLink
          :to="{ name: convertedRoute(props.request.converted_to.type), params: { id: props.request.converted_to.id } }"
          @click="visible = false"
        >
          l'ouvrir
        </RouterLink>
      </Message>

      <div v-if="props.request" class="form-field form-field--full">
        <RequestLinks :request="props.request" :can-edit="auth.can('client_requests.update')" @navigate="visible = false" />
      </div>

      <div class="form-field form-field--full">
        <label for="request-client">Client</label>
        <AutoComplete
          v-model="form.client"
          input-id="request-client"
          :suggestions="clientSuggestions"
          option-label="name"
          placeholder="Rechercher un client existant (facultatif)"
          force-selection
          :delay="250"
          @complete="searchClients"
        />
        <small v-if="fieldError('client_id')" class="field-error">{{ fieldError('client_id') }}</small>
      </div>

      <template v-if="!form.client || typeof form.client !== 'object'">
        <div class="form-field">
          <label for="request-contact-name">Ou nom de la personne</label>
          <InputText id="request-contact-name" v-model="form.contact_name" />
        </div>
        <div class="form-field">
          <label for="request-contact-phone">Téléphone</label>
          <InputText id="request-contact-phone" v-model="form.contact_phone" type="tel" />
        </div>
      </template>

      <div class="form-field form-field--full">
        <label>Origine</label>
        <SelectButton
          v-model="form.source"
          :options="sourceOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>

      <div v-if="!more" class="form-field--full">
        <Button label="Plus d'options" icon="pi pi-chevron-down" size="small" text @click="more = true" />
        <Button v-if="canManage" label="Me le rappeler demain" icon="pi pi-bell" size="small" text @click="remindTomorrow" />
      </div>

      <template v-if="more">
        <div class="form-field">
          <label for="request-priority">Priorité</label>
          <Select
            id="request-priority"
            v-model="form.priority"
            :options="priorityOptions"
            option-label="label"
            option-value="value"
          />
        </div>

        <div v-if="isEdit && canManage" class="form-field">
          <label for="request-status">Statut</label>
          <Select
            id="request-status"
            v-model="form.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
          />
        </div>

        <template v-if="canManage">
          <div class="form-field">
            <label for="request-assignee">Personne en charge</label>
            <Select
              id="request-assignee"
              v-model="form.assigned_to"
              :options="assigneeOptions"
              option-label="label"
              option-value="value"
              filter
              :invalid="!!fieldError('assigned_to')"
            />
            <small v-if="fieldError('assigned_to')" class="field-error">{{ fieldError('assigned_to') }}</small>
          </div>

          <div class="form-field">
            <label for="request-remind">Me le rappeler le</label>
            <DatePicker
              v-model="form.remind_at"
              input-id="request-remind"
              show-time
              hour-format="24"
              show-button-bar
              date-format="dd/mm/yy"
            />
          </div>
        </template>
      </template>

      <p v-if="props.request" class="form-field--full muted meta">
        Notée {{ formatDateTime(props.request.created_at) }}
        <template v-if="props.request.creator"> par {{ props.request.creator.full_name }}</template>
        <template v-if="props.request.processed_at">
          · {{ props.request.status.label }} le {{ formatDateTime(props.request.processed_at) }}
          <template v-if="props.request.processor"> par {{ props.request.processor.full_name }}</template>
        </template>
      </p>
    </form>

    <template #footer>
      <div class="convert">
        <Button v-if="canConvertTask" label="En tâche" icon="pi pi-check-square" severity="secondary" outlined @click="openConvert('task')" />
        <Button v-if="canConvertQuote" label="En devis" icon="pi pi-file-edit" severity="secondary" outlined @click="openConvert('quote')" />
        <Button v-if="canConvert" label="En projet" icon="pi pi-briefcase" severity="secondary" outlined @click="openConvert('project')" />
      </div>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="client-request-form" :loading="saving" />
    </template>
  </Dialog>

  <Dialog v-model:visible="convertOpen" :header="{ quote: 'Transformer en devis', task: 'Transformer en tâche', project: 'Transformer en projet' }[convertType]" modal :style="{ width: '480px' }" :breakpoints="{ '520px': '95vw' }">
    <div class="form-field">
      <label for="convert-name">{{ { quote: 'Objet du devis', task: 'Titre de la tâche', project: 'Nom du projet' }[convertType] }}</label>
      <InputText id="convert-name" v-model="convertName" autofocus />
      <small class="muted">
        Client : {{ form.client && typeof form.client === 'object' ? form.client.name : 'à choisir dans la demande' }}.
        La demande passera à « Traitée » et gardera le lien vers {{ { quote: 'le devis', task: 'la tâche', project: 'le projet' }[convertType] }}.
      </small>
    </div>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="convertOpen = false" />
      <Button :label="{ quote: 'Créer le devis', task: 'Créer la tâche', project: 'Créer le projet' }[convertType]" icon="pi pi-check" :loading="converting" @click="convert" />
    </template>
  </Dialog>
</template>

<style scoped>
.convert {
  margin-right: auto;
  display: flex;
  gap: 0.5rem;
}

.meta {
  margin: 0;
  font-size: 0.85rem;
}
</style>
