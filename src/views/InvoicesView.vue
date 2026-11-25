<script setup lang="ts">
import ViewModeToggle from '@/components/ViewModeToggle.vue'
import { useViewMode } from '@/composables/useViewMode'
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { DataTablePageEvent } from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError, formatMoney } from '@dash4/shared'
import type { Invoice, InvoiceFilters, InvoiceSummary } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import InvoiceTable from '@/components/invoices/InvoiceTable.vue'
import InvoiceCreateDialog from '@/components/invoices/InvoiceCreateDialog.vue'

const viewMode = useViewMode('invoices')
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToast()
const router = useRouter()

type Scope = 'unpaid' | 'overdue' | 'draft' | 'paid' | 'all'
const scopes = [
  { value: 'unpaid', label: 'À encaisser' },
  { value: 'overdue', label: 'En retard' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'paid', label: 'Payées' },
  { value: 'all', label: 'Toutes' },
]
const FILTER: Record<Scope, InvoiceFilters> = {
  unpaid: { unpaid: true },
  overdue: { overdue: true },
  draft: { status: 'draft' },
  paid: { status: 'paid' },
  all: {},
}

const invoices = ref<Invoice[]>([])
const summary = ref<InvoiceSummary | null>(null)
const total = ref(0)
const loading = ref(false)
const filters = reactive({ scope: 'unpaid' as Scope, search: '', page: 1, per_page: 25 })
const createOpen = ref(false)
const money = (v: number) => formatMoney(v, settings.currency())

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.invoices.list({
      ...FILTER[filters.scope],
      search: filters.search || undefined,
      page: filters.page,
      per_page: filters.per_page,
    })
    invoices.value = result.data
    total.value = result.meta.total
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: e instanceof ApiError ? e.message : undefined, life: 5000 })
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.search,
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      filters.page = 1
      void load()
    }, 300)
  },
)
watch(
  () => filters.scope,
  () => {
    filters.page = 1
    void load()
  },
)

function onPage(event: DataTablePageEvent): void {
  filters.page = event.page + 1
  filters.per_page = event.rows
  void load()
}

onMounted(() => {
  void settings.load()
  void load()
  api.invoices.summary().then((s) => (summary.value = s)).catch(() => undefined)
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Factures</h1>
      <ViewModeToggle v-model="viewMode" class="view-toggle" />
      <Button v-if="auth.can('invoices.create')" label="Facture libre" icon="pi pi-plus" severity="secondary" @click="createOpen = true" />
    </div>

    <div v-if="summary" class="kpis">
      <button type="button" class="kpi" @click="filters.scope = 'unpaid'">
        <span class="muted">À encaisser</span>
        <strong>{{ money(summary.to_collect) }}</strong>
        <small class="muted">{{ summary.unpaid_count }} facture(s)</small>
      </button>
      <button type="button" class="kpi" :class="{ alert: summary.overdue_count }" @click="filters.scope = 'overdue'">
        <span class="muted">En retard</span>
        <strong>{{ money(summary.overdue_amount) }}</strong>
        <small class="muted">{{ summary.overdue_count }} facture(s)</small>
      </button>
      <div class="kpi">
        <span class="muted">Encaissé ce mois-ci</span>
        <strong>{{ money(summary.collected_this_month) }}</strong>
      </div>
      <button type="button" class="kpi" @click="filters.scope = 'draft'">
        <span class="muted">Brouillons</span>
        <strong>{{ summary.drafts }}</strong>
      </button>
    </div>

    <div class="filters">
      <SelectButton v-model="filters.scope" :options="scopes" option-label="label" option-value="value" :allow-empty="false" />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Numéro, titre, client" />
      </IconField>
    </div>
    <p class="muted hint">Pour facturer un devis accepté, ouvrez le devis puis « Facturer ».</p>

    <InvoiceTable
      :cards="viewMode === 'cards'"
      :invoices="invoices"
      :currency="settings.currency()"
      :loading="loading"
      :total="total"
      :rows="filters.per_page"
      lazy
      @page="onPage"
    />

    <InvoiceCreateDialog v-model:visible="createOpen" :currency="settings.currency()" @created="(i) => router.push({ name: 'invoice', params: { id: i.id } })" />
  </div>
</template>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  background: var(--p-content-background);
  color: inherit;
  font: inherit;
  text-align: left;
}

button.kpi {
  cursor: pointer;
}

.kpi strong {
  font-size: 1.25rem;
}

.kpi.alert strong {
  color: var(--p-red-500);
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}
</style>
