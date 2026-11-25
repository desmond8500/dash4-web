<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import CardGrid from '@/components/CardGrid.vue'
import type { Journal } from '@dash4/shared'
import { formatDate } from '@/utils/projects'

const props = defineProps<{ journals: Journal[]; loading?: boolean; lazy?: boolean; total?: number; hideProject?: boolean; cards?: boolean }>()
const emit = defineEmits<{ page: [event: DataTablePageEvent] }>()
const router = useRouter()
const openJournal = (j: Journal) => router.push({ name: 'journal', params: { id: j.id } })
const open = (e: DataTableRowClickEvent) => openJournal(e.data as Journal)
</script>

<template>
  <CardGrid
    v-if="props.cards"
    :items="props.journals"
    :loading="props.loading"
    :lazy="props.lazy"
    :total="props.total"
    :rows="50"
    :rows-per-page-options="[50]"
    empty-text="Aucun journal."
    @open="openJournal"
    @page="emit('page', $event)"
  >
    <template #card="{ item }">
      <div class="card-head">
        <div>
          <span class="card-title">{{ item.title }}</span>
          <span class="card-sub">{{ [props.hideProject ? null : item.project?.name, item.client?.name].filter(Boolean).join(' · ') }}</span>
        </div>
      </div>
      <div class="card-meta">
        <span><i class="pi pi-calendar" /> {{ formatDate(item.date) }}</span>
        <span v-if="item.participants?.length"><i class="pi pi-users" /> {{ item.participants.map((p) => p.name).join(', ') }}</span>
        <span v-if="item.photos_count"><i class="pi pi-images" /> {{ item.photos_count }} photo{{ item.photos_count > 1 ? 's' : '' }}</span>
      </div>
      <div class="card-foot"><Tag :value="item.type.label" severity="secondary" /></div>
    </template>
  </CardGrid>
  <DataTable v-else :value="props.journals" :loading="props.loading" :lazy="props.lazy" :paginator="props.lazy" :rows="50" :total-records="props.total" data-key="id" row-hover class="clickable" @row-click="open" @page="emit('page', $event)">
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
