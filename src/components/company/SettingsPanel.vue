<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { ApiError, computeTotals, DOCUMENT_TYPE_LABELS, formatMoney, TAX_MODE_LABELS } from '@dash4/shared'
import type { AppSettings, Currency, DocumentType, TaxMode } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const toast = useToast()
const canEdit = auth.can('settings.update')

const settings = ref<AppSettings | null>(null)
const form = reactive({
  currency: 'XOF' as Currency,
  vat_rate: 18,
  brs_rate: 5,
  default_tax: 'vat' as TaxMode,
  numbering: {} as Record<DocumentType, string>,
})
const previews = ref<Partial<Record<DocumentType, string>>>({})
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)

const currencies = [
  { value: 'XOF', label: 'Franc CFA (F CFA)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'USD', label: 'Dollar ($)' },
]
const taxOptions = (Object.entries(TAX_MODE_LABELS) as Array<[TaxMode, string]>).map(([value, label]) => ({ value, label }))
const types = Object.entries(DOCUMENT_TYPE_LABELS) as Array<[DocumentType, string]>

/** Exemple chiffré pour 1 000 000 hors taxes, avec les taux saisis. */
const example = computed(() =>
  (['vat', 'brs', 'none'] as TaxMode[]).map((mode) => ({
    mode,
    label: TAX_MODE_LABELS[mode],
    totals: computeTotals(1_000_000, mode, form),
  })),
)

function fill(s: AppSettings): void {
  settings.value = s
  Object.assign(form, {
    currency: s.currency,
    vat_rate: s.vat_rate,
    brs_rate: s.brs_rate,
    default_tax: s.default_tax,
    numbering: { ...s.numbering },
  })
  previews.value = { ...s.next_numbers }
}

onMounted(async () => {
  try {
    fill(await api.settings.get())
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  }
})

// Aperçu du prochain numéro pendant la saisie d'un format
const timers: Partial<Record<DocumentType, ReturnType<typeof setTimeout>>> = {}
watch(
  () => ({ ...form.numbering }),
  (now, before) => {
    for (const [type] of types) {
      if (!before || now[type] === before[type] || !now[type]) continue
      clearTimeout(timers[type])
      timers[type] = setTimeout(async () => {
        try {
          previews.value[type] = await api.settings.numberingPreview(type, now[type])
        } catch {
          previews.value[type] = '—'
        }
      }, 300)
    }
  },
)

const fieldError = (f: string) => errors.value[f]?.[0]

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  try {
    fill(await api.settings.update({ ...form, numbering: { ...form.numbering } }))
    toast.add({ severity: 'success', summary: 'Paramètres enregistrés', life: 2500 })
  } catch (e) {
    if (e instanceof ApiError) errors.value = e.errors
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form v-if="settings" class="form-grid" @submit.prevent="save">
    <div class="form-field">
      <label for="s-currency">Devise</label>
      <Select id="s-currency" v-model="form.currency" :options="currencies" option-label="label" option-value="value" :disabled="!canEdit" />
    </div>
    <div class="form-field">
      <label>Taxe par défaut des devis et factures</label>
      <SelectButton v-model="form.default_tax" :options="taxOptions" option-label="label" option-value="value" :allow-empty="false" :disabled="!canEdit" />
    </div>
    <div class="form-field">
      <label for="s-vat">Taux de TVA (%)</label>
      <InputNumber v-model="form.vat_rate" input-id="s-vat" :min="0" :max="100" :max-fraction-digits="2" suffix=" %" :disabled="!canEdit" :invalid="!!fieldError('vat_rate')" />
    </div>
    <div class="form-field">
      <label for="s-brs">Taux de BRS (%) — entreprises individuelles</label>
      <InputNumber v-model="form.brs_rate" input-id="s-brs" :min="0" :max="100" :max-fraction-digits="2" suffix=" %" :disabled="!canEdit" :invalid="!!fieldError('brs_rate')" />
    </div>

    <div class="form-field form-field--full">
      <label>Exemple pour 1 000 000 hors taxes</label>
      <table class="example">
        <tr v-for="row in example" :key="row.mode" :class="{ current: row.mode === form.default_tax }">
          <td>{{ row.label }}</td>
          <td>
            <template v-if="row.mode === 'vat'">+ {{ formatMoney(row.totals.tax, form.currency) }} de TVA</template>
            <template v-else-if="row.mode === 'brs'">− {{ formatMoney(row.totals.tax, form.currency) }} retenus</template>
            <template v-else>—</template>
          </td>
          <td><strong>{{ formatMoney(row.totals.total, form.currency) }}</strong></td>
        </tr>
      </table>
    </div>

    <div class="form-field form-field--full">
      <label>Numérotation des documents</label>
      <small class="muted">{YYYY} année · {YY} année sur 2 chiffres · {MM} mois · {####} numéro. La numérotation repart à 1 chaque année.</small>
      <div v-for="[type, label] in types" :key="type" class="numbering">
        <span class="type">{{ label }}</span>
        <InputText v-model="form.numbering[type]" :disabled="!canEdit" :invalid="!!fieldError(`numbering.${type}`)" />
        <span class="muted next">Prochain : <code>{{ previews[type] ?? '…' }}</code></span>
        <small v-if="fieldError(`numbering.${type}`)" class="field-error full">{{ fieldError(`numbering.${type}`) }}</small>
      </div>
    </div>

    <Message v-if="!canEdit" class="form-field--full" severity="info" :closable="false">
      Lecture seule : seul l'administrateur modifie les paramètres.
    </Message>
    <div v-else class="form-field--full">
      <Button type="submit" label="Enregistrer" icon="pi pi-check" :loading="saving" />
    </div>
  </form>
</template>

<style scoped>
.example {
  border-collapse: collapse;
  max-width: 560px;
}

.example td {
  padding: 0.375rem 1rem 0.375rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.example tr.current td {
  color: var(--p-primary-color);
}

.numbering {
  display: grid;
  grid-template-columns: 11rem minmax(12rem, 18rem) 1fr;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.numbering .full {
  grid-column: 2 / -1;
}

@media (max-width: 720px) {
  .numbering {
    grid-template-columns: 1fr;
  }

  .numbering .full {
    grid-column: auto;
  }
}
</style>
