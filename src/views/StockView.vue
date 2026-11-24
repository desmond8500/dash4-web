<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError, formatMoney, QUOTE_LINE_CATEGORY_LABELS } from '@dash4/shared'
import type { Article, QuoteLineCategory, StockSummary } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ArticleFormDialog from '@/components/stock/ArticleFormDialog.vue'
import { formatQty, stockState } from '@/utils/stock'

const auth = useAuthStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()

const articles = ref<Article[]>([])
const summary = ref<StockSummary | null>(null)
const total = ref(0)
const loading = ref(false)
const createOpen = ref(false)
const categories = [
  { value: null, label: 'Toutes catégories' },
  ...(Object.entries(QUOTE_LINE_CATEGORY_LABELS) as Array<[QuoteLineCategory, string]>).map(([value, label]) => ({ value, label })),
]
const filters = reactive({
  scope: 'active' as 'active' | 'low' | 'inactive',
  search: '',
  category: null as QuoteLineCategory | null,
  provider_id: route.query.provider_id ? Number(route.query.provider_id) : undefined,
  page: 1,
  per_page: 50,
})
const showPrices = auth.can('prices.view')
const showCosts = auth.can('costs.view')

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.articles.list({
      search: filters.search || undefined,
      category: filters.category ?? undefined,
      provider_id: filters.provider_id,
      low: filters.scope === 'low',
      active: filters.scope !== 'inactive',
      page: filters.page,
      per_page: filters.per_page,
    })
    articles.value = result.data
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
  () => [filters.scope, filters.category],
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

const open = (event: DataTableRowClickEvent) => router.push({ name: 'article', params: { id: (event.data as Article).id } })

onMounted(() => {
  void load()
  api.articles.summary().then((s) => (summary.value = s)).catch(() => undefined)
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Stock</h1>
      <div class="header-actions">
        <Button label="Emplacements" icon="pi pi-map-marker" severity="secondary" @click="router.push({ name: 'storage-locations' })" />
        <Button label="Mouvements" icon="pi pi-history" severity="secondary" @click="router.push({ name: 'stock-movements' })" />
        <Button v-if="auth.canAny(['tools.view', 'tools.view.own'])" label="Outillage" icon="pi pi-wrench" severity="secondary" @click="router.push({ name: 'tools' })" />
        <Button label="Fournisseurs et marques" icon="pi pi-truck" severity="secondary" @click="router.push({ name: 'providers' })" />
        <Button label="Icônes des plans" icon="pi pi-th-large" severity="secondary" @click="router.push({ name: 'plan-icons' })" />
        <Button v-if="auth.can('stock.create')" label="Nouvel article" icon="pi pi-plus" @click="createOpen = true" />
      </div>
    </div>

    <div v-if="summary" class="kpis">
      <div class="kpi"><span class="muted">Articles actifs</span><strong>{{ summary.articles }}</strong></div>
      <button type="button" class="kpi" :class="{ alert: summary.low }" @click="filters.scope = 'low'">
        <span class="muted">Stock bas</span><strong>{{ summary.low }}</strong>
      </button>
      <div class="kpi" :class="{ alert: summary.out }"><span class="muted">En rupture</span><strong>{{ summary.out }}</strong></div>
      <div v-if="summary.stock_value !== undefined" class="kpi"><span class="muted">Valeur du stock (coût)</span><strong>{{ formatMoney(summary.stock_value) }}</strong></div>
    </div>

    <div class="filters">
      <SelectButton
        v-model="filters.scope"
        :options="[{ v: 'active', l: 'Actifs' }, { v: 'low', l: 'Stock bas' }, { v: 'inactive', l: 'Inactifs' }]"
        option-label="l"
        option-value="v"
        :allow-empty="false"
      />
      <Select v-model="filters.category" :options="categories" option-label="label" option-value="value" />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Désignation, référence, code-barres, marque" class="search" />
      </IconField>
      <span v-if="filters.provider_id" class="muted">Un seul fournisseur · <a href="#" @click.prevent="(filters.provider_id = undefined), load()">tous</a></span>
    </div>

    <DataTable
      :value="articles"
      :loading="loading"
      lazy
      paginator
      :rows="filters.per_page"
      :total-records="total"
      :rows-per-page-options="[50, 100]"
      data-key="id"
      row-hover
      class="clickable"
      @row-click="open"
      @page="onPage"
    >
      <template #empty>Aucun article.</template>
      <Column header="" style="width: 3.5rem">
        <template #body="{ data }">
          <img v-if="data.image_url" :src="data.image_url" alt="" class="thumb" />
          <i v-else class="pi pi-box thumb-empty" />
        </template>
      </Column>
      <Column header="Article">
        <template #body="{ data }">
          <div class="title">
            <strong>{{ data.designation }}</strong>
            <span class="muted">
              {{ [data.reference, data.brand?.name, data.category.label].filter(Boolean).join(' · ') }}
            </span>
          </div>
        </template>
      </Column>
      <Column header="Emplacement" style="width: 9rem">
        <template #body="{ data }">{{ data.location ?? '' }}</template>
      </Column>
      <Column header="Stock" class="num" style="width: 9rem">
        <template #body="{ data }">
          <strong>{{ formatQty(data.quantity) }}</strong> {{ data.unit ?? '' }}
          <div v-if="data.min_quantity !== null" class="muted small">seuil {{ formatQty(data.min_quantity) }}</div>
        </template>
      </Column>
      <Column header="État" style="width: 7rem">
        <template #body="{ data }"><Tag :value="stockState(data).label" :severity="stockState(data).severity" /></template>
      </Column>
      <Column v-if="showCosts" header="Coût" class="num" style="width: 8rem">
        <template #body="{ data }">{{ formatMoney(data.unit_cost ?? 0) }}</template>
      </Column>
      <Column v-if="showPrices" header="Prix de vente" class="num" style="width: 8rem">
        <template #body="{ data }">{{ formatMoney(data.unit_price ?? 0) }}</template>
      </Column>
    </DataTable>

    <ArticleFormDialog v-model:visible="createOpen" @saved="(a) => router.push({ name: 'article', params: { id: a.id } })" />
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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

.search {
  min-width: 18rem;
}

.clickable :deep(tbody tr) {
  cursor: pointer;
}

.title {
  display: flex;
  flex-direction: column;
}

.thumb {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
  border-radius: 0.25rem;
}

.thumb-empty {
  font-size: 1.25rem;
  color: var(--p-text-muted-color);
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
