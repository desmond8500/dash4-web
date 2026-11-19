<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import type { Task } from '@dash4/shared'
import { formatDate } from '@/utils/projects'
import { taskStatusSeverity } from '@/utils/tasks'

const props = defineProps<{ tasks: Task[]; loading?: boolean; lazy?: boolean; total?: number; rows?: number; hideProject?: boolean }>()
const emit = defineEmits<{ page: [event: DataTablePageEvent] }>()
const router = useRouter()
const open = (e: DataTableRowClickEvent) => router.push({ name: 'task', params: { id: (e.data as Task).id } })
const slot = (t: Task) => (t.starts_at ? `${formatDate(t.starts_at.slice(0, 10))} ${t.starts_at.slice(11, 16)}` : '')
</script>

<template>
  <DataTable
    :value="props.tasks"
    :loading="props.loading"
    :lazy="props.lazy"
    :paginator="props.lazy"
    :rows="props.rows ?? 50"
    :total-records="props.total"
    data-key="id"
    row-hover
    class="clickable"
    @row-click="open"
    @page="emit('page', $event)"
  >
    <template #empty>Aucune tâche.</template>
    <Column header="Tâche">
      <template #body="{ data }">
        <strong :class="{ done: data.status.value === 'done' }">{{ data.title }}</strong>
        <i v-if="data.priority.value === 'high'" class="pi pi-exclamation-circle urgent" title="Urgente" />
        <div class="muted small">
          {{ [props.hideProject ? null : data.project?.name, data.client?.name, data.subtasks_count ? `${data.subtasks_done}/${data.subtasks_count} sous-tâches` : null].filter(Boolean).join(' · ') }}
        </div>
      </template>
    </Column>
    <Column header="Personnes" style="width: 13rem">
      <template #body="{ data }">
        <span v-if="data.assignees?.length">{{ data.assignees.map((a: { full_name: string }) => a.full_name).join(', ') }}</span>
        <span v-else class="muted">Non affectée</span>
      </template>
    </Column>
    <Column header="Planifiée" style="width: 9rem"><template #body="{ data }">{{ slot(data) }}</template></Column>
    <Column header="Échéance" style="width: 8rem">
      <template #body="{ data }"><span :class="{ late: data.is_overdue }">{{ formatDate(data.due_date) }}</span></template>
    </Column>
    <Column header="Statut" style="width: 8rem">
      <template #body="{ data }"><Tag :value="data.is_overdue ? 'En retard' : data.status.label" :severity="data.is_overdue ? 'danger' : taskStatusSeverity(data.status.value)" /></template>
    </Column>
  </DataTable>
</template>

<style scoped>
.clickable :deep(tbody tr) {
  cursor: pointer;
}

.done {
  text-decoration: line-through;
  color: var(--p-text-muted-color);
}

.urgent {
  margin-left: 0.375rem;
  color: var(--p-red-500);
}

.late {
  color: var(--p-red-500);
  font-weight: 600;
}

.small {
  font-size: 0.8rem;
}
</style>
