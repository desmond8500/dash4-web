<script setup lang="ts">
import { reactive, ref } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { formatMoney } from '@dash4/shared'
import type { Currency, Quote, QuoteExpense } from '@dash4/shared'
import { api } from '@/services/api'
import { formatDate, toApiDate } from '@/utils/projects'

/** Dépenses réelles du devis (achats, sous-traitance, transport…) et marge réelle : costs.view. */
const props = defineProps<{ quote: Quote; currency: Currency; canEdit: boolean }>()
const emit = defineEmits<{ run: [action: () => Promise<Quote>] }>()
const toast = useToast()

const form = reactive({ label: '', amount: null as number | null, date: new Date() as Date | null })
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const money = (v: number | undefined) => (v === undefined ? '' : formatMoney(Math.round(v), props.currency))

function add(): void {
  if (!form.label.trim() || form.amount === null) return
  const f = file.value
  emit('run', () =>
    api.quotes.addExpense(
      props.quote.id,
      { label: form.label.trim(), amount: form.amount!, spent_at: toApiDate(form.date) ?? undefined },
      f ?? undefined,
      f?.name,
    ),
  )
  Object.assign(form, { label: '', amount: null })
  file.value = null
}

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  input.value = ''
}

async function openReceipt(expense: QuoteExpense): Promise<void> {
  if (!expense.document) return
  try {
    const url = URL.createObjectURL(await api.documents.download(expense.document))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Justificatif introuvable', detail: (e as Error).message, life: 4000 })
  }
}

const remove = (e: QuoteExpense) => emit('run', () => api.quotes.removeExpense(e.id))
</script>

<template>
  <div class="panel">
    <table v-if="props.quote.expenses?.length" class="list">
      <thead><tr><th>Date</th><th>Libellé</th><th>Justificatif</th><th class="num">Montant</th><th v-if="props.canEdit" /></tr></thead>
      <tbody>
        <tr v-for="e in props.quote.expenses" :key="e.id">
          <td>{{ formatDate(e.spent_at) }}</td>
          <td>{{ e.label }}<div v-if="e.creator" class="muted small">{{ e.creator.full_name }}</div></td>
          <td>
            <button v-if="e.document" type="button" class="link" @click="openReceipt(e)"><i class="pi pi-paperclip" /> Ouvrir</button>
            <span v-else class="muted">—</span>
          </td>
          <td class="num">{{ money(e.amount) }}</td>
          <td v-if="props.canEdit" class="actions">
            <Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer" @click="remove(e)" />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr><td colspan="3">Total des dépenses</td><td class="num">{{ money(props.quote.expenses_total) }}</td><td /></tr>
        <tr class="strong">
          <td colspan="3">Marge réelle (net hors taxes − dépenses)</td>
          <td class="num" :class="{ negative: (props.quote.real_margin ?? 0) < 0 }">{{ money(props.quote.real_margin) }}</td>
          <td />
        </tr>
      </tfoot>
    </table>
    <p v-else class="muted">Aucune dépense enregistrée.</p>

    <form v-if="props.canEdit" class="add" @submit.prevent="add">
      <DatePicker v-model="form.date" date-format="dd/mm/yy" />
      <InputText v-model="form.label" placeholder="Libellé (ex. : achat caméras)" class="label" />
      <InputNumber v-model="form.amount" :min="0" placeholder="Montant" />
      <Button :label="file ? file.name : 'Justificatif'" icon="pi pi-paperclip" size="small" severity="secondary" outlined @click="fileInput?.click()" />
      <input ref="fileInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" hidden @change="onFile" />
      <Button type="submit" label="Ajouter" icon="pi pi-plus" size="small" :disabled="!form.label.trim() || form.amount === null" />
    </form>
  </div>
</template>
