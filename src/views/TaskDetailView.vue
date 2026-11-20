<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import ProgressBar from 'primevue/progressbar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { Task, TaskStatus } from '@dash4/shared'
import { api } from '@/services/api'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import CommentsPanel from '@/components/CommentsPanel.vue'
import TaskDialog from '@/components/tasks/TaskDialog.vue'
import JournalCreateDialog from '@/components/journals/JournalCreateDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/projects'
import { formatDateTime } from '@/utils/clientRequests'
import { taskStatusSeverity, timeRange } from '@/utils/tasks'

const props = defineProps<{ id: string }>()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const task = ref<Task | null>(null)
const commentsCount = ref(0)
const loading = ref(true)
const notFound = ref(false)
const busy = ref(false)
const editOpen = ref(false)
const tab = ref(useRoute().query.onglet === 'commentaires' ? 'comments' : 'notes')
const newSubtask = ref('')
const journalOpen = ref(false)
const auth = useAuthStore()

const progress = computed(() => (task.value?.subtasks_count ? Math.round((task.value.subtasks_done / task.value.subtasks_count) * 100) : 0))
const mapUrl = computed(() => {
  const p = task.value?.project
  return p?.latitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}` : null
})
const nextStatuses = computed<Array<{ value: TaskStatus; label: string; icon: string; severity?: 'success' | 'danger' | 'secondary' }>>(() => {
  switch (task.value?.status.value) {
    case 'todo':
      return [{ value: 'in_progress', label: 'Commencer', icon: 'pi pi-play' }, { value: 'done', label: 'Terminer', icon: 'pi pi-check', severity: 'success' }]
    case 'in_progress':
      return [{ value: 'done', label: 'Terminer', icon: 'pi pi-check', severity: 'success' }, { value: 'blocked', label: 'Bloquée', icon: 'pi pi-ban', severity: 'danger' }]
    case 'blocked':
      return [{ value: 'in_progress', label: 'Reprendre', icon: 'pi pi-play' }]
    default:
      return [{ value: 'todo', label: 'Rouvrir', icon: 'pi pi-replay', severity: 'secondary' }]
  }
})

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    task.value = await api.tasks.get(Number(props.id))
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

async function run(action: () => Promise<Task>): Promise<void> {
  busy.value = true
  try {
    task.value = await action()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    busy.value = false
  }
}
const id = () => task.value!.id
const setStatus = (status: TaskStatus) => run(() => api.tasks.update(id(), { status }))
function addSubtask(): void {
  const title = newSubtask.value.trim()
  if (!title) return
  void run(() => api.tasks.addSubtask(id(), title)).then(() => (newSubtask.value = ''))
}
function remove(): void {
  confirm.require({
    header: 'Supprimer la tâche',
    message: `Supprimer « ${task.value?.title} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.tasks.remove(id())
      void router.push({ name: 'tasks' })
    },
  })
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !task" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Cette tâche n'existe pas, a été supprimée, ou ne vous concerne pas.</p>
      <RouterLink :to="{ name: 'tasks' }">Retour aux tâches</RouterLink>
    </div>

    <template v-else-if="task">
      <RouterLink :to="{ name: 'tasks' }" class="back"><i class="pi pi-arrow-left" /> Tâches</RouterLink>
      <div class="page-header">
        <div class="title">
          <h1>{{ task!.title }}</h1>
          <Tag :value="task!.status.label" :severity="taskStatusSeverity(task!.status.value)" />
          <Tag v-if="task!.priority.value === 'high'" value="Urgente" severity="danger" />
          <Tag v-if="task!.is_overdue" value="En retard" severity="danger" icon="pi pi-clock" />
        </div>
        <div class="actions">
          <template v-if="task!.can.progress">
            <Button v-for="s in nextStatuses" :key="s.value" :label="s.label" :icon="s.icon" :severity="s.severity" :loading="busy" @click="setStatus(s.value)" />
          </template>
          <Button v-if="auth.can('journals.create')" label="Rédiger le journal" icon="pi pi-book" severity="secondary" @click="journalOpen = true" />
          <Button v-if="task!.can.update" label="Modifier" icon="pi pi-pencil" severity="secondary" @click="editOpen = true" />
          <Button v-if="task!.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" @click="remove" />
        </div>
      </div>

      <div class="layout">
        <div class="main">
          <Card>
            <template #content>
              <p v-if="task!.description" class="pre">{{ task!.description }}</p>
              <p v-else class="muted">Pas de description.</p>

              <h3>Sous-tâches <span v-if="task!.subtasks_count" class="muted small">{{ task!.subtasks_done }}/{{ task!.subtasks_count }}</span></h3>
              <ProgressBar v-if="task!.subtasks_count" :value="progress" :show-value="false" class="bar" />
              <ul class="subtasks">
                <li v-for="s in task!.subtasks" :key="s.id">
                  <Checkbox :model-value="s.is_done" binary :disabled="!task.can.progress || busy" @update:model-value="(v: boolean) => run(() => api.tasks.updateSubtask(s.id, { is_done: v }))" />
                  <span :class="{ done: s.is_done }">{{ s.title }}</span>
                  <Button v-if="task!.can.progress" icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Retirer" @click="run(() => api.tasks.removeSubtask(s.id))" />
                </li>
              </ul>
              <form v-if="task!.can.progress" class="add" @submit.prevent="addSubtask">
                <InputText v-model="newSubtask" placeholder="Ajouter une sous-tâche" />
                <Button type="submit" icon="pi pi-plus" size="small" :disabled="!newSubtask.trim()" aria-label="Ajouter" />
              </form>
            </template>
          </Card>

          <Tabs v-model:value="tab">
            <TabList>
              <Tab value="comments">Commentaires <span v-if="commentsCount" class="count">{{ commentsCount }}</span></Tab>
              <Tab value="notes">Notes</Tab>
              <Tab value="documents">Photos et documents</Tab>
              <Tab value="links">Liens</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="comments"><CommentsPanel type="tasks" :id="task!.id" @changed="commentsCount = $event" /></TabPanel>
              <TabPanel v-for="kind in (['notes', 'documents', 'links'] as const)" :key="kind" :value="kind">
                <AttachmentsPanel :kind="kind" type="tasks" :id="task!.id" :can-add="task!.can.progress" :can-manage="task!.can.delete" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        <Card class="side">
          <template #content>
            <dl class="facts">
              <dt>Planifiée</dt>
              <dd>
                <template v-if="task!.starts_at">
                  {{ formatDate(task!.starts_at.slice(0, 10)) }}<template v-if="task!.ends_at && task!.ends_at.slice(0, 10) !== task!.starts_at.slice(0, 10)"> → {{ formatDate(task!.ends_at.slice(0, 10)) }}</template>
                  <div class="muted small">{{ timeRange(task) }}</div>
                </template>
                <template v-else>Non planifiée</template>
              </dd>
              <dt>Échéance</dt><dd :class="{ late: task!.is_overdue }">{{ formatDate(task!.due_date) }}</dd>
              <dt>Personnes</dt>
              <dd>
                <div v-for="a in task!.assignees" :key="a.id">{{ a.full_name }}</div>
                <span v-if="!task.assignees?.length" class="muted">Non affectée</span>
              </dd>
              <dt>Projet</dt>
              <dd>
                <RouterLink v-if="task!.project" :to="{ name: 'project', params: { id: task!.project.id } }">{{ task!.project.name }}</RouterLink>
                <template v-else>—</template>
              </dd>
              <dt>Lieu</dt>
              <dd>
                {{ task!.location ?? task!.project?.address ?? task!.client?.address ?? '—' }}
                <div v-if="mapUrl"><a :href="mapUrl" target="_blank" rel="noopener" class="small"><i class="pi pi-map-marker" /> Itinéraire</a></div>
              </dd>
              <template v-if="task!.client"><dt>Client</dt><dd><RouterLink :to="{ name: 'client', params: { id: task!.client.id } }">{{ task!.client.name }}</RouterLink></dd></template>
              <template v-if="task!.quote"><dt>Devis</dt><dd><RouterLink :to="{ name: 'quote', params: { id: task!.quote.id } }">{{ task!.quote.number }}</RouterLink></dd></template>
              <dt>Créée par</dt><dd>{{ task!.creator?.full_name ?? '—' }}</dd>
              <template v-if="task!.completed_at"><dt>Terminée</dt><dd>{{ formatDateTime(task!.completed_at) }}<div class="muted small">{{ task!.completer?.full_name }}</div></dd></template>
            </dl>
          </template>
        </Card>
      </div>

      <JournalCreateDialog v-model:visible="journalOpen" :task="task" @created="(j) => router.push({ name: 'journal', params: { id: j.id } })" />
      <TaskDialog v-model:visible="editOpen" :task="task" @saved="(t) => (task = t)" />
    </template>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.title,
.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.title h1 {
  margin: 0;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.pre {
  white-space: pre-wrap;
}

.bar {
  height: 0.5rem;
  margin-bottom: 0.5rem;
}

.subtasks {
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem;
}

.subtasks li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.done {
  text-decoration: line-through;
  color: var(--p-text-muted-color);
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  margin: 0;
}

.facts dt {
  color: var(--p-text-muted-color);
}

.facts dd {
  margin: 0;
}

.late {
  color: var(--p-red-500);
  font-weight: 600;
}

.small {
  font-size: 0.8rem;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}
</style>
