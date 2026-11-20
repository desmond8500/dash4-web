<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { formatMoney } from '@dash4/shared'
import type { Currency, Invoice } from '@dash4/shared'
import { formatDate } from '@/utils/projects'
import { invoiceStatusSeverity } from '@/utils/invoices'

/** Tableau de factures (liste, fiche client). */
const props = defineProps<{
  invoices: Invoice[]
  currency: Currency
  loading?: boolean
  lazy?: boolean
  total?: number
  rows?: number
  hideClient?: boolean
}>()
const emit = defineEmits<{ page: [event: DataTablePageEvent] }>()
const router = useRouter()

function open(event: DataTableRowClickEvent): void {
  void router.push({ name: 'invoice', params: { id: (event.data as Invoice).id } })
}
</script>

<template>
  <DataTable
    :value="props.invoices"
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
    <template #empty>Aucune facture.</template>
    <Column header="Numéro" style="width: 10rem">
      <template #body="{ data }">
        <strong v-if="data.number">{{ data.number }}</strong>
        <span v-else class="muted">Brouillon</span>
      </template>
    </Column>
    <Column header="Titre">
      <template #body="{ data }">
        <div class="title">
          <span>{{ data.title }}</span>
          <span class="muted">
            <template v-if="!props.hideClient">{{ data.client?.name }}</template>
            <template v-if="data.quote"><template v-if="!props.hideClient"> · </template>{{ data.quote.number }}</template>
          </span>
        </div>
      </template>
    </Column>
    <Column header="Date" style="width: 7rem">
      <template #body="{ data }">{{ formatDate(data.issued_at) }}</template>
    </Column>
    <Column header="Échéance" style="width: 7rem">
      <template #body="{ data }">
        <span :class="{ late: data.is_overdue }">{{ formatDate(data.due_at) }}</span>
      </template>
    </Column>
    <Column header="Statut" style="width: 9rem">
      <template #body="{ data }">
        <Tag :value="data.is_overdue ? 'En retard' : data.status.label" :severity="data.is_overdue ? 'danger' : invoiceStatusSeverity(data.status.value)" />
      </template>
    </Column>
    <Column header="Total" class="num" style="width: 9rem">
      <template #body="{ data }">{{ formatMoney(data.total, props.currency) }}</template>
    </Column>
    <Column header="Reste à payer" class="num" style="width: 9rem">
      <template #body="{ data }">
        <template v-if="data.status.value !== 'draft' && data.status.value !== 'cancelled'">{{ formatMoney(data.remaining_amount, props.currency) }}</template>
      </template>
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

.late {
  color: var(--p-red-500);
  font-weight: 600;
}

:deep(td.num),
:deep(th.num) {
  text-align: right;
  white-space: nowrap;
}
</style>
