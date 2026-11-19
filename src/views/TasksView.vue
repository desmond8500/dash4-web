<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { DataTablePageEvent } from 'primevue/datatable'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { Task, TaskFilters, TaskSummary } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import TaskDialog from '@/components/tasks/TaskDialog.vue'
import TaskTable from '@/components/tasks/TaskTable.vue'

const auth = useAuthStore()
const toast = useToast()
const router = useRouter()

type Scope = 'mine' | 'open' | 'overdue' | 'unscheduled' | 'done'
const FILTER: Record<Scope, TaskFilters> = {
  mine: { assigned_to: 'me', open: true },
  open: { open: true },
  overdue: { overdue: true },
  unscheduled: { unscheduled: true, open: true },
  done: { status: 'done,cancelled' },
}
const tasks = ref<Task[]>([])
const summary = ref<TaskSummary | null>(null)
const total = ref(0)
const loading = ref(false)
const createOpen = ref(false)
const filters = reactive({ scope: 'open' as Scope, search: '', page: 1 })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.tasks.list({ ...FILTER[filters.scope], search: filters.search || undefined, page: filters.page, per_page: 50 })
    tasks.value = result.data
    total.value = result.meta.total
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: e instanceof ApiError ? e.message : undefined, life: 5000 })
  } finally {
    loading.value = false
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.search,
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      filters.page = 1
      void load()
    }, 300)
  },
)
watch(
  () => filters.scope,
  () => {
    filters.page = 1
    void load()
  },
)
function onPage(e: DataTablePageEvent): void {
  filters.page = e.page + 1
  void load()
}
onMounted(() => {
  void load()
  api.tasks.summary().then((s) => (summary.value = s)).catch(() => undefined)
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Tâches</h1>
      <div class="actions">
        <Button label="Planning" icon="pi pi-calendar" severity="secondary" @click="router.push({ name: 'planning' })" />
        <Button v-if="auth.can('tasks.create')" label="Nouvelle tâche" icon="pi pi-plus" @click="createOpen = true" />
      </div>
    </div>

    <div v-if="summary" class="kpis">
      <button type="button" class="kpi" @click="filters.scope = 'mine'"><span class="muted">Mes tâches ouvertes</span><strong>{{ summary.mine_open }}</strong><small class="muted">dont {{ summary.mine_today }} aujourd'hui</small></button>
      <button type="button" class="kpi" :class="{ alert: summary.overdue }" @click="filters.scope = 'overdue'"><span class="muted">En retard</span><strong>{{ summary.overdue }}</strong></button>
      <div v-if="auth.can('tasks.assign')" class="kpi" :class="{ alert: summary.unassigned }"><span class="muted">Non affectées</span><strong>{{ summary.unassigned }}</strong></div>
    </div>

    <div class="filters">
      <SelectButton
        v-model="filters.scope"
        :options="[{ v: 'open', l: 'Ouvertes' }, { v: 'mine', l: 'Les miennes' }, { v: 'overdue', l: 'En retard' }, { v: 'unscheduled', l: 'Non planifiées' }, { v: 'done', l: 'Terminées' }]"
        option-label="l"
        option-value="v"
        :allow-empty="false"
      />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Titre" />
      </IconField>
    </div>

    <TaskTable :tasks="tasks" :loading="loading" lazy :total="total" @page="onPage" />
    <TaskDialog v-model:visible="createOpen" @saved="(t) => router.push({ name: 'task', params: { id: t.id } })" />
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.5rem;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  background: var(--p-content-background);
  color: inherit;
  font: inherit;
  text-align: left;
}

button.kpi {
  cursor: pointer;
}

.kpi strong {
  font-size: 1.25rem;
}

.kpi.alert strong {
  color: var(--p-red-500);
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
</style>
