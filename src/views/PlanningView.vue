<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { Journal, Task, TaskPayload, UserRef } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import TaskDialog from '@/components/tasks/TaskDialog.vue'
import { isoDate, isOnDay, moveToDay, planningRows, timeRange, weekDays } from '@/utils/tasks'

/**
 * Planning de la semaine : une ligne par personne, une colonne par jour. Glisser une tâche vers
 * un autre jour la déplace (même heure, même durée) ; vers une autre personne, la réaffecte.
 * Les tâches non planifiées se glissent sur le planning.
 */
const auth = useAuthStore()
const toast = useToast()
const router = useRouter()

const anchor = ref(new Date())
const days = computed(() => weekDays(anchor.value))
const today = isoDate(new Date())
const scheduled = ref<Task[]>([])
const unscheduled = ref<Task[]>([])
const onlyMine = ref(!auth.can('tasks.view'))
const loading = ref(false)
const journals = ref<Journal[]>([])
const journalPeople = computed<UserRef[]>(() => {
  const map = new Map<number, UserRef>()
  for (const j of journals.value) for (const p of j.participants ?? []) if (p.user_id) map.set(p.user_id, { id: p.user_id, full_name: p.name } as UserRef)
  return [...map.values()]
})
const rows = computed(() => planningRows(scheduled.value, journalPeople.value))
/** Journaux du jour pour une ligne (personne qui est intervenue, ou aucune). */
const journalsFor = (day: string, personId: number | null) =>
  journals.value.filter(
    (j) => j.date === day && (personId ? (j.participants ?? []).some((p) => p.user_id === personId) : !(j.participants ?? []).some((p) => p.user_id)),
  )
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const weekLabel = computed(() => {
  const first = new Date(`${days.value[0]}T00:00:00`)
  const last = new Date(`${days.value[6]}T00:00:00`)
  return `Du ${first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
})

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  loading.value = true
  const mine = onlyMine.value ? { assigned_to: 'me' as const } : {}
  try {
    const [week, todo] = await Promise.all([
      api.tasks.list({ from: days.value[0], to: days.value[6], status: 'todo,in_progress,blocked,done', per_page: 200, ...mine }),
      api.tasks.list({ unscheduled: true, open: true, per_page: 100, ...mine }),
    ])
    scheduled.value = week.data
    unscheduled.value = todo.data
    journals.value = auth.canAny(['journals.view', 'journals.view.own'])
      ? (await api.journals.list({ from: days.value[0], to: days.value[6], per_page: 200, ...(onlyMine.value ? { mine: true } : {}) }).catch(() => ({ data: [] as Journal[] }))).data
      : []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Planning indisponible', detail: errorDetail(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
watch([days, onlyMine], load)
onMounted(load)

function shift(weeks: number): void {
  const d = new Date(anchor.value)
  d.setDate(d.getDate() + weeks * 7)
  anchor.value = d
}

// Glisser-déposer
const dragged = ref<{ task: Task; fromPerson: number | null } | null>(null)
function onDragStart(task: Task, fromPerson: number | null): void {
  dragged.value = { task, fromPerson }
}
async function onDrop(day: string, toPerson: number | null): Promise<void> {
  const drag = dragged.value
  dragged.value = null
  if (!drag) return
  const t = drag.task
  if (!t.can.update) {
    toast.add({ severity: 'warn', summary: "Vous ne pouvez pas déplacer cette tâche.", life: 3000 })
    return
  }
  const payload: TaskPayload = t.starts_at ? moveToDay(t, day) : { starts_at: `${day} 08:00`, ends_at: `${day} 17:00` }
  if (toPerson !== drag.fromPerson) {
    if (!t.can.assign) {
      toast.add({ severity: 'warn', summary: "Vous ne pouvez pas réaffecter cette tâche.", life: 3000 })
      return
    }
    const ids = (t.assignees ?? []).map((a) => a.id).filter((id) => id !== drag.fromPerson)
    payload.assignee_ids = toPerson && !ids.includes(toPerson) ? [...ids, toPerson] : ids
  }
  try {
    await api.tasks.update(t.id, payload)
    void load()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Déplacement impossible', detail: errorDetail(e), life: 5000 })
  }
}

// Nouvelle tâche depuis une case
const dialogOpen = ref(false)
const dialogDay = ref<string | null>(null)
const dialogPerson = ref<number | null>(null)
function create(day: string | null, person: number | null): void {
  if (!auth.can('tasks.create')) return
  dialogDay.value = day
  dialogPerson.value = person
  dialogOpen.value = true
}
const open = (t: Task) => router.push({ name: 'task', params: { id: t.id } })
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Planning</h1>
      <div class="actions">
        <label v-if="auth.can('tasks.view')" class="switch"><ToggleSwitch v-model="onlyMine" /> Seulement moi</label>
        <Button v-if="auth.can('tasks.create')" label="Nouvelle tâche" icon="pi pi-plus" @click="create(null, null)" />
      </div>
    </div>

    <div class="week-nav">
      <Button icon="pi pi-chevron-left" text rounded aria-label="Semaine précédente" @click="shift(-1)" />
      <Button label="Cette semaine" text size="small" @click="anchor = new Date()" />
      <Button icon="pi pi-chevron-right" text rounded aria-label="Semaine suivante" @click="shift(1)" />
      <strong>{{ weekLabel }}</strong>
      <i v-if="loading" class="pi pi-spin pi-spinner muted" />
    </div>

    <div class="layout">
      <div class="grid-wrap">
        <table class="grid">
          <thead>
            <tr>
              <th class="person-col" />
              <th v-for="d in days" :key="d" :class="{ today: d === today }">{{ dayLabel(d) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <th class="person-col">{{ row.person?.full_name ?? 'Non affectées' }}</th>
              <td
                v-for="d in days"
                :key="d"
                :class="{ today: d === today, weekend: days.indexOf(d) >= 5 }"
                @dragover.prevent
                @drop="onDrop(d, row.person?.id ?? null)"
                @dblclick.self="create(d, row.person?.id ?? null)"
              >
                <div
                  v-for="t in row.tasks.filter((x) => isOnDay(x, d))"
                  :key="t.id"
                  class="card"
                  :class="[t.status.value, { urgent: t.priority.value === 'high' }]"
                  :draggable="t.can.update"
                  @dragstart="onDragStart(t, row.person?.id ?? null)"
                  @click="open(t)"
                >
                  <small v-if="timeRange(t, d)" class="time">{{ timeRange(t, d) }}</small>
                  <span class="name">{{ t.title }}</span>
                  <small v-if="t.project" class="muted">{{ t.project.name }}</small>
                </div>
                <div v-for="j in journalsFor(d, row.person?.id ?? null)" :key="`j${j.id}`" class="card journal" @click="router.push({ name: 'journal', params: { id: j.id } })">
                  <small class="time"><i class="pi pi-book" /> Journal</small>
                  <span class="name">{{ j.title }}</span>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length">
              <th class="person-col muted">—</th>
              <td v-for="d in days" :key="d" :class="{ today: d === today }" @dragover.prevent @drop="onDrop(d, null)" @dblclick="create(d, null)" />
            </tr>
          </tbody>
        </table>
        <p class="muted small"><span class="legend-journal" /> journaux d'intervention de la semaine. Glissez une tâche pour la déplacer ou la confier à quelqu'un d'autre ; double-cliquez une case vide pour créer une tâche ce jour-là.</p>
      </div>

      <aside class="unscheduled">
        <h3>Non planifiées <span class="muted">({{ unscheduled.length }})</span></h3>
        <div
          v-for="t in unscheduled"
          :key="t.id"
          class="card"
          :class="{ urgent: t.priority.value === 'high', late: t.is_overdue }"
          :draggable="t.can.update"
          @dragstart="onDragStart(t, t.assignees?.[0]?.id ?? null)"
          @click="open(t)"
        >
          <span class="name">{{ t.title }}</span>
          <small class="muted">{{ [t.assignees?.map((a) => a.full_name).join(', ') || 'Non affectée', t.due_date ? `avant le ${new Date(`${t.due_date}T00:00:00`).toLocaleDateString('fr-FR')}` : null].filter(Boolean).join(' · ') }}</small>
        </div>
        <p v-if="!unscheduled.length" class="muted small">Tout est planifié.</p>
      </aside>
    </div>

    <TaskDialog v-model:visible="dialogOpen" :day="dialogDay" :assignee-id="dialogPerson" @saved="load" />
  </div>
</template>

<style scoped>
.actions,
.week-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.grid-wrap {
  overflow-x: auto;
}

.grid {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  table-layout: fixed;
}

.grid th,
.grid td {
  border: 1px solid var(--p-content-border-color);
  vertical-align: top;
  padding: 0.25rem;
}

.grid thead th {
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: capitalize;
  padding: 0.5rem 0.25rem;
}

.person-col {
  width: 9rem;
  text-align: left;
  font-size: 0.9rem;
}

.grid td {
  height: 5.5rem;
}

.today {
  background: color-mix(in srgb, var(--p-primary-color) 7%, transparent);
}

.weekend {
  background: var(--p-content-hover-background);
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem 0.5rem;
  margin-bottom: 0.25rem;
  border-radius: 0.375rem;
  border-left: 3px solid var(--p-blue-500);
  background: var(--p-content-background);
  box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
  font-size: 0.8rem;
  cursor: pointer;
}

.card[draggable='true'] {
  cursor: grab;
}

.card.in_progress {
  border-left-color: var(--p-orange-500);
}

.card.blocked {
  border-left-color: var(--p-red-500);
}

.card.done {
  border-left-color: var(--p-green-500);
  opacity: 0.65;
}

.card.done .name {
  text-decoration: line-through;
}

.card.urgent .name::before {
  content: '! ';
  color: var(--p-red-500);
  font-weight: 700;
}

.card.journal {
  border-left-color: var(--p-purple-500);
  background: color-mix(in srgb, var(--p-purple-500) 6%, var(--p-content-background));
}

.card.late {
  border-left-color: var(--p-red-500);
}

.name {
  font-weight: 600;
}

.time {
  color: var(--p-text-muted-color);
}

.unscheduled h3 {
  margin-top: 0;
}

.small {
  font-size: 0.8rem;
}

.legend-journal {
  display: inline-block;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
  background: var(--p-purple-500);
}
</style>
