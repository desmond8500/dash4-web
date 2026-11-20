<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, TECH_SHARE_CATEGORIES } from '@dash4/shared'
import type { Assignee, Project, Task, TechShare } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { defaultExpiry, shareFormError, sharePayload } from '@/utils/techSpace'
import type { ShareForm } from '@/utils/techSpace'

/** Nouvelle information temporaire, ou modification (destinataires, expiration, contenu). */
const props = defineProps<{ share?: TechShare | null; taskId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [share: TechShare] }>()
const auth = useAuthStore()

const people = ref<Assignee[]>([])
const projects = ref<Project[]>([])
const tasks = ref<Task[]>([])
const form = ref<ShareForm>(blank())
const error = ref<string | null>(null)
const saving = ref(false)
const technicians = computed(() => [...people.value].sort((a, b) => Number(b.account_type === 'technician') - Number(a.account_type === 'technician')))

function blank(): ShareForm {
  return { category: 'info', title: '', content: '', project_id: null, task_id: props.taskId ?? null, expires_at: defaultExpiry(), expires_with_task: false, recipients: [] }
}

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  const s = props.share
  form.value = s
    ? {
        category: s.category.value, title: s.title, content: s.content ?? '', project_id: s.project_id, task_id: s.task_id,
        expires_at: s.expires_at ? new Date(s.expires_at) : null, expires_with_task: s.expires_with_task,
        recipients: (s.recipients ?? []).map((r) => r.id),
      }
    : blank()
  const [p, pr, t] = await Promise.all([
    api.assignees.list().catch(() => [] as Assignee[]),
    auth.canAny(['projects.view', 'projects.view.own']) ? api.projects.list({ per_page: 100 }).then((r) => r.data).catch(() => [] as Project[]) : Promise.resolve([] as Project[]),
    api.tasks.list({ open: true, per_page: 100 }).then((r) => r.data).catch(() => [] as Task[]),
  ])
  people.value = p.filter((x) => x.id !== auth.user?.id)
  projects.value = pr
  tasks.value = t
})

function onTask(): void {
  const t = tasks.value.find((x) => x.id === form.value.task_id)
  if (t?.project_id) form.value.project_id = t.project_id
  // Les personnes affectées à la tâche sont proposées comme destinataires
  if (t?.assignees?.length && !form.value.recipients.length) form.value.recipients = t.assignees.map((a) => a.id).filter((id) => id !== auth.user?.id)
}

async function save(): Promise<void> {
  error.value = shareFormError(form.value)
  if (error.value) return
  saving.value = true
  try {
    const payload = sharePayload(form.value)
    const share = props.share ? await api.techShares.update(props.share.id, payload) : await api.techShares.create({ ...payload, client_uuid: crypto.randomUUID() })
    visible.value = false
    emit('saved', share)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.share ? 'Modifier l\'information' : 'Nouvelle information temporaire'" modal :style="{ width: '600px' }" :breakpoints="{ '640px': '95vw' }">
    <form id="tech-share" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field"><label for="ts-cat">Catégorie</label><Select id="ts-cat" v-model="form.category" :options="TECH_SHARE_CATEGORIES" option-label="label" option-value="value" /></div>
      <div class="form-field"><label for="ts-title">Titre</label><InputText id="ts-title" v-model="form.title" placeholder="Code du portail, clé du local…" autofocus /></div>
      <div class="form-field form-field--full">
        <label for="ts-content">Contenu</label>
        <Textarea id="ts-content" v-model="form.content" rows="4" auto-resize placeholder="Effacé à l'expiration." />
        <small class="muted">Les fichiers s'ajoutent une fois l'information créée ; ils sont effacés avec elle.</small>
      </div>
      <div class="form-field form-field--full">
        <label for="ts-to">Destinataires</label>
        <MultiSelect id="ts-to" v-model="form.recipients" :options="technicians" option-label="full_name" option-value="id" filter display="chip" placeholder="Techniciens et autres personnes">
          <template #option="{ option }">{{ option.full_name }}<small v-if="option.account_type === 'technician'" class="muted">&nbsp;· technicien</small></template>
        </MultiSelect>
      </div>
      <div class="form-field">
        <label for="ts-task">Tâche</label>
        <Select id="ts-task" v-model="form.task_id" :options="[{ id: null, title: 'Aucune' }, ...tasks]" option-label="title" option-value="id" filter @change="onTask" />
      </div>
      <div v-if="projects.length" class="form-field">
        <label for="ts-project">Projet</label>
        <Select id="ts-project" v-model="form.project_id" :options="[{ id: null, name: 'Aucun' }, ...projects]" option-label="name" option-value="id" filter :disabled="!!form.task_id" />
      </div>
      <div class="form-field form-field--full">
        <label class="switch"><ToggleSwitch v-model="form.expires_with_task" :disabled="!form.task_id" /> Expire à la fin de la tâche</label>
      </div>
      <div v-if="!form.expires_with_task" class="form-field">
        <label for="ts-exp">Visible jusqu'au</label>
        <DatePicker v-model="form.expires_at" input-id="ts-exp" show-time hour-format="24" date-format="dd/mm/yy" :min-date="new Date()" />
      </div>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button :label="props.share ? 'Enregistrer' : 'Envoyer'" icon="pi pi-send" type="submit" form="tech-share" :loading="saving" />
    </template>
  </Dialog>
</template>
