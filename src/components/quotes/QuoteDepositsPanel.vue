<script setup lang="ts">
import { reactive, ref } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { formatMoney } from '@dash4/shared'
import type { Currency, Quote, QuoteDeposit, QuoteDepositPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { formatDate, toApiDate } from '@/utils/projects'

/** Acomptes du devis : en montant ou en pourcentage du total, payés ou à régler. */
const props = defineProps<{ quote: Quote; currency: Currency; canEdit: boolean }>()
const emit = defineEmits<{ run: [action: () => Promise<Quote>] }>()

const mode = ref<'percent' | 'amount'>('percent')
const form = reactive({ label: 'Acompte à la commande', percent: 50, amount: 0, due: null as Date | null })
const money = (v: number | undefined) => (v === undefined ? '' : formatMoney(v, props.currency))

function add(): void {
  const payload: QuoteDepositPayload = {
    label: form.label.trim() || 'Acompte',
    due_date: toApiDate(form.due),
    ...(mode.value === 'percent' ? { percent: form.percent } : { amount: form.amount }),
  }
  emit('run', () => api.quotes.addDeposit(props.quote.id, payload))
  form.due = null
}

const togglePaid = (d: QuoteDeposit) => emit('run', () => api.quotes.updateDeposit(d.id, { is_paid: !d.is_paid }))
const togglePdf = (d: QuoteDeposit) => emit('run', () => api.quotes.updateDeposit(d.id, { show_on_pdf: !d.show_on_pdf }))
const remove = (d: QuoteDeposit) => emit('run', () => api.quotes.removeDeposit(d.id))
</script>

<template>
  <div class="panel">
    <table v-if="props.quote.deposits?.length" class="list">
      <thead>
        <tr><th>Libellé</th><th>Échéance</th><th>État</th><th class="num">Montant</th><th>Sur le PDF</th><th v-if="props.canEdit" /></tr>
      </thead>
      <tbody>
        <tr v-for="d in props.quote.deposits" :key="d.id">
          <td>{{ d.label }}</td>
          <td>{{ formatDate(d.due_date) || '—' }}</td>
          <td>
            <Tag v-if="d.is_paid" :value="`Reçu le ${formatDate(d.paid_at)}`" severity="success" />
            <Tag v-else value="À régler" severity="warn" />
          </td>
          <td class="num">{{ money(d.amount) }}</td>
          <td><Checkbox :model-value="d.show_on_pdf" binary :disabled="!props.canEdit" @update:model-value="togglePdf(d)" /></td>
          <td v-if="props.canEdit" class="actions">
            <Button :label="d.is_paid ? 'Non reçu' : 'Marquer reçu'" size="small" text @click="togglePaid(d)" />
            <Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer" @click="remove(d)" />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr><td colspan="3">Total des acomptes</td><td class="num">{{ money(props.quote.deposits_total) }}</td><td colspan="2" /></tr>
        <tr><td colspan="3">Déjà reçu</td><td class="num">{{ money(props.quote.deposits_paid) }}</td><td colspan="2" /></tr>
        <tr class="strong"><td colspan="3">Reste à payer</td><td class="num">{{ money(props.quote.remaining_amount) }}</td><td colspan="2" /></tr>
      </tfoot>
    </table>
    <p v-else class="muted">Aucun acompte.</p>

    <form v-if="props.canEdit" class="add" @submit.prevent="add">
      <InputText v-model="form.label" placeholder="Libellé" class="label" />
      <SelectButton v-model="mode" :options="[{ v: 'percent', l: '%' }, { v: 'amount', l: 'Montant' }]" option-label="l" option-value="v" :allow-empty="false" />
      <InputNumber v-if="mode === 'percent'" v-model="form.percent" :min="0.01" :max="100" suffix=" %" :max-fraction-digits="2" />
      <InputNumber v-else v-model="form.amount" :min="1" :suffix="` ${props.currency === 'XOF' ? 'F CFA' : props.currency}`" />
      <DatePicker v-model="form.due" placeholder="Échéance" date-format="dd/mm/yy" show-button-bar />
      <Button type="submit" label="Ajouter" icon="pi pi-plus" size="small" />
      <small v-if="mode === 'percent' && props.quote.total" class="muted full">
        Soit {{ money(Math.round((props.quote.total * form.percent) / 100)) }} sur {{ money(props.quote.total) }}.
      </small>
    </form>
  </div>
</template>
