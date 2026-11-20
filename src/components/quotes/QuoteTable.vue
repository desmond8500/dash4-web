<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { formatMoney } from '@dash4/shared'
import type { Currency, Quote } from '@dash4/shared'
import { formatDate } from '@/utils/projects'
import { quoteStatusSeverity } from '@/utils/quotes'

/** Tableau de devis (liste, fiche client, fiche projet). */
const props = defineProps<{
  quotes: Quote[]
  currency: Currency
  showPrices: boolean
  loading?: boolean
  lazy?: boolean
  total?: number
  rows?: number
  hideClient?: boolean
}>()
const emit = defineEmits<{ page: [event: DataTablePageEvent] }>()
const router = useRouter()

function open(event: DataTableRowClickEvent): void {
  void router.push({ name: 'quote', params: { id: (event.data as Quote).id } })
}
</script>

<template>
  <DataTable
    :value="props.quotes"
    :loading="props.loading"
    :lazy="props.lazy"
    :paginator="props.lazy"
    :rows="props.rows ?? 25"
    :total-records="props.total"
    :rows-per-page-options="[25, 50, 100]"
    data-key="id"
    row-hover
    class="clickable"
    @row-click="open"
    @page="emit('page', $event)"
  >
    <template #empty>Aucun devis.</template>
    <Column header="Numéro" style="width: 10rem">
      <template #body="{ data }">
        <strong>{{ data.number }}</strong>
        <i v-if="data.is_favorite" class="pi pi-star-fill favorite" aria-label="Favori" />
      </template>
    </Column>
    <Column header="Objet">
      <template #body="{ data }">
        <div class="title">
          <span>{{ data.title }}</span>
          <span v-if="!props.hideClient || data.project" class="muted">
            <template v-if="!props.hideClient">{{ data.client?.name }}</template>
            <template v-if="data.project"> · {{ data.project.name }}</template>
          </span>
        </div>
      </template>
    </Column>
    <Column header="Date" style="width: 7rem">
      <template #body="{ data }">{{ formatDate(data.issued_at) }}</template>
    </Column>
    <Column header="Statut" style="width: 8rem">
      <template #body="{ data }">
        <Tag :value="data.status.label" :severity="quoteStatusSeverity(data.status.value)" />
        <i v-if="data.signed_at" class="pi pi-verified signed" title="Copie signée reçue" />
      </template>
    </Column>
    <Column v-if="props.showPrices" header="Total" class="num" style="width: 10rem">
      <template #body="{ data }">{{ data.total !== undefined ? formatMoney(data.total, props.currency) : '' }}</template>
    </Column>
  </DataTable>
</template>

<style scoped>
.clickable :deep(tbody tr) {
  cursor: pointer;
}

.title {
  display: flex;
  flex-direction: column;
}

.favorite {
  color: var(--p-yellow-500);
  margin-left: 0.375rem;
}

.signed {
  color: var(--p-green-500);
  margin-left: 0.375rem;
}

:deep(td.num),
:deep(th.num) {
  text-align: right;
  white-space: nowrap;
}
</style>
