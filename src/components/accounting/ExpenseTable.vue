<script setup lang="ts">
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { formatMoney } from '@dash4/shared'
import type { Expense } from '@dash4/shared'
import { formatDate } from '@/utils/projects'
import { expenseStatusSeverity } from '@/utils/accounting'

const props = defineProps<{ expenses: Expense[]; loading?: boolean; lazy?: boolean; total?: number; rows?: number; hideSpace?: boolean }>()
const emit = defineEmits<{ open: [expense: Expense]; page: [event: DataTablePageEvent] }>()
</script>

<template>
  <DataTable
    :value="props.expenses"
    :loading="props.loading"
    :lazy="props.lazy"
    :paginator="props.lazy"
    :rows="props.rows ?? 50"
    :total-records="props.total"
    data-key="id"
    row-hover
    class="clickable"
    @row-click="(e: DataTableRowClickEvent) => emit('open', e.data as Expense)"
    @page="emit('page', $event)"
  >
    <template #empty>Aucune dépense.</template>
    <Column header="Date" style="width: 7rem"><template #body="{ data }">{{ formatDate(data.spent_at) }}</template></Column>
    <Column header="Dépense">
      <template #body="{ data }">
        <strong>{{ data.label }}</strong>
        <i v-if="data.document" class="pi pi-paperclip muted clip" title="Justificatif" />
        <div class="muted small">
          {{ [data.category?.name, data.project?.name, props.hideSpace ? null : data.space?.name, data.quote ? `Devis ${data.quote.number}` : null].filter(Boolean).join(' · ') }}
        </div>
      </template>
    </Column>
    <Column header="Par" style="width: 11rem">
      <template #body="{ data }">
        {{ data.creator?.full_name ?? '—' }}
        <div v-if="data.advanced" class="muted small">avancée{{ data.status.value === 'reimbursed' ? ', remboursée' : '' }}</div>
      </template>
    </Column>
    <Column header="Statut" style="width: 9rem">
      <template #body="{ data }">
        <Tag :value="data.to_reimburse ? 'À rembourser' : data.status.label" :severity="data.to_reimburse ? 'warn' : expenseStatusSeverity(data.status.value)" />
      </template>
    </Column>
    <Column header="Montant" class="num" style="width: 9rem"><template #body="{ data }">{{ formatMoney(data.amount) }}</template></Column>
  </DataTable>
</template>

<style scoped>
.clickable :deep(tbody tr) {
  cursor: pointer;
}

.clip {
  margin-left: 0.375rem;
}

.small {
  font-size: 0.8rem;
}

:deep(td.num),
:deep(th.num) {
  text-align: right;
  white-space: nowrap;
}
</style>
