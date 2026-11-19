<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, PRIORITY_LABELS, TASK_STATUS_LABELS } from '@dash4/shared'
import type { Assignee, Priority, Project, Task, TaskPayload, TaskStatus } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { fromApiDateTime, toApiDateTime } from '@/utils/tasks'
import { fromApiDate, toApiDate } from '@/utils/projects'

/** Nouvelle tâche ou modification : projet, créneau, échéance, personnes, priorité, sous-tâches. */
const props = defineProps<{
  task?: Task | null
  projectId?: number | null
  /** Créneau proposé (clic sur un jour du planning). */
  day?: string | null
  assigneeId?: number | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [task: Task] }>()
const auth = useAuthStore()

const projects = ref<Project[]>([])
const people = ref<Assignee[]>([])
const error = ref<string | null>(null)
const saving = ref(false)
const editing = computed(() => !!props.task)
const canAssign = computed(() => (props.task ? props.task.can.assign : auth.can('tasks.assign')))
const priorities = (Object.entries(PRIORITY_LABELS) as Array<[Priority, string]>).map(([value, label]) => ({ value, label }))
const statuses = (Object.entries(TASK_STATUS_LABELS) as Array<[TaskStatus, string]>).map(([value, label]) => ({ value, label }))

const form = ref({
  title: '',
  description: '',
  status: 'todo' as TaskStatus,
  priority: 'normal' as Priority,
  project_id: null as number | null,
  location: '',
  starts: null as Date | null,
  ends: null as Date | null,
  due: null as Date | null,
  assignee_ids: [] as number[],
  subtasks: '',
})

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  const t = props.task
  const dayStart = props.day ? new Date(`${props.day}T08:00:00`) : null
  form.value = {
    title: t?.title ?? '',
    description: t?.description ?? '',
    status: t?.status.value ?? 'todo',
    priority: t?.priority.value ?? 'normal',
    project_id: t?.project_id ?? props.projectId ?? null,
    location: t?.location ?? '',
    starts: t ? fromApiDateTime(t.starts_at) : dayStart,
    ends: t ? fromApiDateTime(t.ends_at) : dayStart ? new Date(`${props.day}T17:00:00`) : null,
    due: t ? fromApiDate(t.due_date) : null,
    assignee_ids: t?.assignees?.map((a) => a.id) ?? (props.assigneeId ? [props.assigneeId] : []),
    subtasks: '',
  }
  const [p, a] = await Promise.allSettled([
    auth.canAny(['projects.view', 'projects.view.own']) ? api.projects.list({ per_page: 100 }) : Promise.reject(new Error()),
    canAssign.value ? api.assignees.list() : Promise.reject(new Error()),
  ])
  projects.value = p.status === 'fulfilled' ? p.value.data : []
  people.value = a.status === 'fulfilled' ? a.value : []
})

async function save(): Promise<void> {
  const f = form.value
  if (!f.title.trim()) {
    error.value = 'Indiquez le titre de la tâche.'
    return
  }
  const payload: TaskPayload = {
    title: f.title.trim(),
    description: f.description.trim() || null,
    priority: f.priority,
    project_id: f.project_id,
    location: f.location.trim() || null,
    starts_at: toApiDateTime(f.starts),
    ends_at: toApiDateTime(f.ends),
    due_date: toApiDate(f.due),
    ...(canAssign.value ? { assignee_ids: f.assignee_ids } : {}),
    ...(editing.value ? { status: f.status } : {}),
  }
  saving.value = true
  error.value = null
  try {
    const subtasks = f.subtasks.split('\n').map((s) => s.trim()).filter(Boolean)
    const saved = props.task
      ? await api.tasks.update(props.task.id, payload)
      : await api.tasks.create({ ...payload, title: payload.title!, subtasks, client_uuid: crypto.randomUUID() })
    visible.value = false
    emit('saved', saved)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="editing ? 'Modifier la tâche' : 'Nouvelle tâche'" modal :style="{ width: '640px' }" :breakpoints="{ '680px': '95vw' }">
    <form id="task-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field form-field--full">
        <label for="t-title">Titre</label>
        <InputText id="t-title" v-model="form.title" placeholder="Ex. : poser 4 caméras au R+1" autofocus />
      </div>
      <div v-if="projects.length" class="form-field">
        <label for="t-project">Projet</label>
        <Select id="t-project" v-model="form.project_id" :options="[{ id: null, name: 'Aucun' }, ...projects]" option-label="name" option-value="id" filter />
      </div>
      <div class="form-field">
        <label for="t-location">Lieu</label>
        <InputText id="t-location" v-model="form.location" placeholder="Si différent du projet" />
      </div>
      <div class="form-field">
        <label for="t-starts">Début</label>
        <DatePicker v-model="form.starts" input-id="t-starts" date-format="dd/mm/yy" show-time hour-format="24" :step-minute="15" show-button-bar />
      </div>
      <div class="form-field">
        <label for="t-ends">Fin</label>
        <DatePicker v-model="form.ends" input-id="t-ends" date-format="dd/mm/yy" show-time hour-format="24" :step-minute="15" show-button-bar :min-date="form.starts ?? undefined" />
      </div>
      <div class="form-field">
        <label for="t-due">Échéance</label>
        <DatePicker v-model="form.due" input-id="t-due" date-format="dd/mm/yy" show-button-bar />
      </div>
      <div class="form-field">
        <label>Priorité</label>
        <SelectButton v-model="form.priority" :options="priorities" option-label="label" option-value="value" :allow-empty="false" />
      </div>
      <div v-if="canAssign" class="form-field form-field--full">
        <label for="t-people">Personnes affectées</label>
        <MultiSelect id="t-people" v-model="form.assignee_ids" :options="people" option-label="full_name" option-value="id" filter display="chip" placeholder="Personne pour l'instant" />
      </div>
      <div v-if="editing" class="form-field">
        <label for="t-status">Statut</label>
        <Select id="t-status" v-model="form.status" :options="statuses" option-label="label" option-value="value" />
      </div>
      <div class="form-field form-field--full">
        <label for="t-desc">Description</label>
        <Textarea id="t-desc" v-model="form.description" rows="3" auto-resize />
      </div>
      <div v-if="!editing" class="form-field form-field--full">
        <label for="t-subtasks">Sous-tâches (une par ligne)</label>
        <Textarea id="t-subtasks" v-model="form.subtasks" rows="3" auto-resize placeholder="Tirer les câbles&#10;Fixer les caméras&#10;Régler l'enregistreur" />
      </div>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button :label="editing ? 'Enregistrer' : 'Créer la tâche'" icon="pi pi-check" type="submit" form="task-form" :loading="saving" />
    </template>
  </Dialog>
</template>
