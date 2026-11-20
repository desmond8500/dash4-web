<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, JOURNAL_TYPES } from '@dash4/shared'
import type { Journal, JournalType, Project, Task } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { toApiDate } from '@/utils/projects'

/** Nouveau journal, depuis un projet ou une tâche (projet, client et intervenants repris). */
const props = defineProps<{ projectId?: number | null; task?: Task | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [journal: Journal] }>()
const auth = useAuthStore()

const projects = ref<Project[]>([])
const form = ref({ title: '', type: 'intervention' as JournalType, date: new Date() as Date | null, project_id: null as number | null })
const error = ref<string | null>(null)
const saving = ref(false)

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  form.value = { title: props.task?.title ?? '', type: 'intervention', date: new Date(), project_id: props.task?.project_id ?? props.projectId ?? null }
  if (!props.task && auth.canAny(['projects.view', 'projects.view.own'])) {
    projects.value = (await api.projects.list({ per_page: 100 }).catch(() => ({ data: [] as Project[] }))).data
  }
})

async function save(): Promise<void> {
  const f = form.value
  if (!f.title.trim() || !f.date) {
    error.value = 'Indiquez le titre et la date.'
    return
  }
  saving.value = true
  try {
    const journal = await api.journals.create({
      client_uuid: crypto.randomUUID(),
      title: f.title.trim(),
      type: f.type,
      date: toApiDate(f.date)!,
      ...(props.task ? { task_id: props.task.id } : { project_id: f.project_id }),
      sections: [{ title: 'Travaux réalisés' }, { title: 'Reste à faire' }],
    })
    visible.value = false
    emit('created', journal)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Nouveau journal d'intervention" modal :style="{ width: '520px' }" :breakpoints="{ '560px': '95vw' }">
    <form id="journal-create" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field form-field--full"><label for="j-title">Titre</label><InputText id="j-title" v-model="form.title" autofocus /></div>
      <div class="form-field"><label for="j-type">Type</label><Select id="j-type" v-model="form.type" :options="JOURNAL_TYPES" option-label="label" option-value="value" /></div>
      <div class="form-field"><label for="j-date">Date</label><DatePicker v-model="form.date" input-id="j-date" date-format="dd/mm/yy" /></div>
      <div v-if="!props.task && projects.length" class="form-field form-field--full">
        <label for="j-project">Projet</label>
        <Select id="j-project" v-model="form.project_id" :options="[{ id: null, name: 'Aucun' }, ...projects]" option-label="name" option-value="id" filter />
      </div>
      <p v-if="props.task" class="form-field--full muted small">Depuis la tâche « {{ props.task.title }} » : projet, client et intervenants repris.</p>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Créer et rédiger" icon="pi pi-check" type="submit" form="journal-create" :loading="saving" />
    </template>
  </Dialog>
</template>
