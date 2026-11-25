<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import CardGrid from '@/components/CardGrid.vue'
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
  /** Affichage en cartes. */
  cards?: boolean
}>()
const emit = defineEmits<{ page: [event: DataTablePageEvent] }>()
const router = useRouter()

function open(event: DataTableRowClickEvent): void {
  openInvoice(event.data as Invoice)
}
function openInvoice(invoice: Invoice): void {
  void router.push({ name: 'invoice', params: { id: invoice.id } })
}
</script>

<template>
  <CardGrid
    v-if="props.cards"
    :items="props.invoices"
    :loading="props.loading"
    :lazy="props.lazy"
    :total="props.total"
    :rows="props.rows ?? 25"
    empty-text="Aucune facture."
    @open="openInvoice"
    @page="emit('page', $event)"
  >
    <template #card="{ item }">
      <div class="card-head">
        <div>
          <span class="card-title">{{ item.number ?? 'Brouillon' }}</span>
          <span class="card-sub">{{ [props.hideClient ? null : item.client?.name, item.quote?.number].filter(Boolean).join(' · ') }}</span>
        </div>
      </div>
      <div class="card-text">{{ item.title }}</div>
      <div class="card-meta">
        <span><i class="pi pi-calendar" /> {{ formatDate(item.issued_at) || '—' }}</span>
        <span v-if="item.due_at" :class="{ late: item.is_overdue }"><i class="pi pi-clock" /> Échéance {{ formatDate(item.due_at) }}</span>
        <span v-if="item.status.value !== 'draft' && item.status.value !== 'cancelled'"><i class="pi pi-wallet" /> Reste {{ formatMoney(item.remaining_amount, props.currency) }}</span>
      </div>
      <div class="card-foot">
        <Tag :value="item.is_overdue ? 'En retard' : item.status.label" :severity="item.is_overdue ? 'danger' : invoiceStatusSeverity(item.status.value)" />
        <span class="card-amount">{{ formatMoney(item.total, props.currency) }}</span>
      </div>
    </template>
  </CardGrid>
  <DataTable
    v-else
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
