<script setup lang="ts">
import { ref } from 'vue'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Menu from 'primevue/menu'
import type { ClientRequest } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import {
  ageLabel,
  formatDateTime,
  priorityIcon,
  quickActions,
  requesterLabel,
  requestStatusSeverity,
  type QuickAction,
} from '@/utils/clientRequests'

/** Tableau des demandes, partagé par la boîte de réception et la fiche client. */
const props = defineProps<{
  requests: ClientRequest[]
  loading?: boolean
  total?: number
  rows?: number
  lazy?: boolean
  hideClient?: boolean
}>()
const emit = defineEmits<{
  open: [request: ClientRequest]
  action: [request: ClientRequest, action: QuickAction]
  page: [event: DataTablePageEvent]
}>()

const auth = useAuthStore()
const menu = ref<InstanceType<typeof Menu> | null>(null)
const menuItems = ref<Array<{ label: string; icon: string; command: () => void }>>([])

function openMenu(event: Event, request: ClientRequest): void {
  menuItems.value = quickActions(request.status.value).map((action) => ({
    label: action.label,
    icon: action.icon,
    command: () => emit('action', request, action),
  }))
  menu.value?.toggle(event)
}

function onRowClick(event: DataTableRowClickEvent): void {
  emit('open', event.data as ClientRequest)
}
</script>

<template>
  <DataTable
    :value="props.requests"
    :loading="props.loading"
    :lazy="props.lazy"
    :paginator="props.lazy"
    :rows="props.rows ?? 25"
    :total-records="props.total"
    :rows-per-page-options="[25, 50, 100]"
    data-key="id"
    row-hover
    class="clickable"
    :row-class="(r: ClientRequest) => (r.is_overdue ? 'overdue' : '')"
    @row-click="onRowClick"
    @page="emit('page', $event)"
  >
    <template #empty>Aucune demande.</template>

    <Column style="width: 2.5rem">
      <template #body="{ data }">
        <i
          :class="[priorityIcon(data.priority.value), `priority-${data.priority.value}`]"
          :title="`Priorité ${data.priority.label.toLowerCase()}`"
        />
      </template>
    </Column>
    <Column header="Demande">
      <template #body="{ data }">
        <div class="request">
          <span class="body">{{ data.body }}</span>
          <span v-if="!props.hideClient" class="muted">
            {{ requesterLabel(data) }}
            <template v-if="!data.client && data.contact_name && data.contact_phone"> · {{ data.contact_phone }}</template>
          </span>
        </div>
      </template>
    </Column>
    <Column header="Origine" style="width: 7rem">
      <template #body="{ data }">{{ data.source.label }}</template>
    </Column>
    <Column header="Statut" style="width: 10rem">
      <template #body="{ data }">
        <div class="status">
          <Tag :value="data.status.label" :severity="requestStatusSeverity(data.status.value)" />
          <Tag v-if="data.is_overdue" value="En retard" severity="danger" />
        </div>
      </template>
    </Column>
    <Column header="En charge" style="width: 10rem">
      <template #body="{ data }">{{ data.assignee?.full_name ?? '—' }}</template>
    </Column>
    <Column header="Notée" style="width: 8rem">
      <template #body="{ data }">
        <span :title="formatDateTime(data.created_at)">{{ ageLabel(data.created_at) }}</span>
        <div v-if="data.remind_at" class="muted remind" :title="'Rappel le ' + formatDateTime(data.remind_at)">
          <i class="pi pi-bell" /> {{ formatDateTime(data.remind_at) }}
        </div>
      </template>
    </Column>
    <Column v-if="auth.can('client_requests.update')" style="width: 3.5rem">
      <template #body="{ data }">
        <Button
          icon="pi pi-ellipsis-v"
          text
          rounded
          aria-label="Actions"
          @click.stop="openMenu($event, data)"
        />
      </template>
    </Column>
  </DataTable>
  <Menu ref="menu" :model="menuItems" popup />
</template>

<style scoped>
.clickable :deep(tbody tr) {
  cursor: pointer;
}

.clickable :deep(tr.overdue) {
  box-shadow: inset 3px 0 0 var(--p-red-500);
}

.request {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.body {
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.remind {
  font-size: 0.8rem;
}

.priority-high {
  color: var(--p-red-500);
}

.priority-low {
  color: var(--p-text-muted-color);
}
</style>
