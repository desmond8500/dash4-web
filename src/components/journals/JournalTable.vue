<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import type { Journal } from '@dash4/shared'
import { formatDate } from '@/utils/projects'

const props = defineProps<{ journals: Journal[]; loading?: boolean; lazy?: boolean; total?: number; hideProject?: boolean }>()
const emit = defineEmits<{ page: [event: DataTablePageEvent] }>()
const router = useRouter()
const open = (e: DataTableRowClickEvent) => router.push({ name: 'journal', params: { id: (e.data as Journal).id } })
</script>

<template>
  <DataTable :value="props.journals" :loading="props.loading" :lazy="props.lazy" :paginator="props.lazy" :rows="50" :total-records="props.total" data-key="id" row-hover class="clickable" @row-click="open" @page="emit('page', $event)">
    <template #empty>Aucun journal.</template>
    <Column header="Date" style="width: 7rem"><template #body="{ data }">{{ formatDate(data.date) }}</template></Column>
    <Column header="Journal">
      <template #body="{ data }">
        <strong>{{ data.title }}</strong>
        <div class="muted small">{{ [props.hideProject ? null : data.project?.name, data.client?.name].filter(Boolean).join(' · ') }}</div>
      </template>
    </Column>
    <Column header="Type" style="width: 9rem"><template #body="{ data }"><Tag :value="data.type.label" severity="secondary" /></template></Column>
    <Column header="Intervenants" style="width: 14rem">
      <template #body="{ data }">{{ (data.participants ?? []).map((p: { name: string }) => p.name).join(', ') }}</template>
    </Column>
    <Column header="Photos" style="width: 5rem"><template #body="{ data }">{{ data.photos_count || '' }}</template></Column>
  </DataTable>
</template>

<style scoped>
.clickable :deep(tbody tr) {
  cursor: pointer;
}

.small {
  font-size: 0.8rem;
}
</style>
