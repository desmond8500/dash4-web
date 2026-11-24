<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import { api } from '@/services/api'
import { exportPeriods } from '@/utils/exports'
import { fromApiDate, toApiDate } from '@/utils/projects'

const toast = useToast()
const types = ref<{ value: string; label: string }[]>([])
const periods = exportPeriods()
const period = ref('month')
const from = ref<Date | null>(fromApiDate(periods[0]!.from))
const to = ref<Date | null>(fromApiDate(periods[0]!.to))
const busy = ref<string | null>(null)
const tables = computed(() => types.value.filter((t) => t.value !== 'fec'))
const fec = computed(() => types.value.find((t) => t.value === 'fec'))

onMounted(async () => {
  try {
    types.value = await api.exports.types()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message, life: 5000 })
  }
})

function pick(key: string): void {
  const p = periods.find((x) => x.key === key)
  if (!p) return
  from.value = fromApiDate(p.from)
  to.value = fromApiDate(p.to)
}

async function download(type: string): Promise<void> {
  const f = toApiDate(from.value)
  const t = toApiDate(to.value)
  if (!f || !t) return
  busy.value = type
  try {
    const blob = await api.exports.download(type, f, t)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'fec' ? `FEC${t.replaceAll('-', '')}.txt` : `${type.replaceAll('_', '-')}-${f}-${t}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Export impossible', detail: e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message, life: 6000 })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Exports comptables</h1>
    </div>

    <Card>
      <template #title>Période</template>
      <template #content>
        <div class="period">
          <SelectButton v-model="period" :options="periods" option-label="label" option-value="key" :allow-empty="false" @change="pick(period)" />
          <div class="dates">
            <label>Du <DatePicker v-model="from" date-format="dd/mm/yy" /></label>
            <label>au <DatePicker v-model="to" date-format="dd/mm/yy" /></label>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Tableaux (CSV)</template>
      <template #content>
        <p class="muted">À ouvrir dans Excel ou LibreOffice. Montants en francs, une ligne par document.</p>
        <div class="buttons">
          <Button v-for="t in tables" :key="t.value" :label="t.label" icon="pi pi-download" severity="secondary" :loading="busy === t.value" @click="download(t.value)" />
        </div>
      </template>
    </Card>

    <Card v-if="fec">
      <template #title>{{ fec.label }}</template>
      <template #content>
        <p class="muted">
          Écritures en partie double de la période : ventes (factures et avoirs), trésorerie (paiements reçus, transactions),
          achats reçus et dépenses validées. Les numéros de comptes suivent le plan SYSCOHADA (411 clients, 706 prestations,
          4431 TVA facturée…) : faites-les valider par votre comptable avant de les importer dans son logiciel.
        </p>
        <Button :label="`Télécharger le journal`" icon="pi pi-download" :loading="busy === 'fec'" @click="download('fec')" />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.period {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.dates,
.buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
.dates label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
