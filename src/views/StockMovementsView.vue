<script setup lang="ts">
import ListSearch from '@/components/ListSearch.vue'
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Paginator, { type PageState } from 'primevue/paginator'
import { useToast } from 'primevue/usetoast'
import { STOCK_MOVEMENT_LABELS } from '@dash4/shared'
import type { StockMovement, StockMovementType } from '@dash4/shared'
import { api } from '@/services/api'
import MovementTable from '@/components/stock/MovementTable.vue'
import { toApiDate } from '@/utils/projects'

/** Journal de tous les mouvements de stock. */
const route = useRoute()
const toast = useToast()
const movements = ref<StockMovement[]>([])
const total = ref(0)
const types = [
  { value: null, label: 'Tous les mouvements' },
  ...(Object.entries(STOCK_MOVEMENT_LABELS) as Array<[StockMovementType, string]>).map(([value, label]) => ({ value, label })),
]
const filters = reactive({
  type: null as StockMovementType | null,
  range: null as Array<Date | null> | null,
  article_id: route.query.article_id ? Number(route.query.article_id) : undefined,
  search: '',
  page: 1,
})

async function load(): Promise<void> {
  try {
    const result = await api.articles.movements({
      type: filters.type ?? undefined,
      from: toApiDate(filters.range?.[0] ?? null) ?? undefined,
      to: toApiDate(filters.range?.[1] ?? null) ?? undefined,
      article_id: filters.article_id,
      search: filters.search.trim() || undefined,
      page: filters.page,
      per_page: 50,
    })
    movements.value = result.data
    total.value = result.meta.total
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  }
}

watch(
  () => [filters.type, filters.range],
  () => {
    filters.page = 1
    void load()
  },
)
// Recherche : relancée après une courte pause de frappe
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      filters.page = 1
      void load()
    }, 300)
  },
)
const onPage = (e: PageState) => {
  filters.page = e.page + 1
  void load()
}
onMounted(load)
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'stock' }" class="back"><i class="pi pi-arrow-left" /> Stock</RouterLink>
    <div class="page-header"><h1>Mouvements de stock</h1></div>
    <div class="filters">
      <ListSearch v-model="filters.search" placeholder="Article, référence, motif, projet…" />
      <Select v-model="filters.type" :options="types" option-label="label" option-value="value" />
      <DatePicker v-model="filters.range" selection-mode="range" date-format="dd/mm/yy" placeholder="Période" show-button-bar />
      <span v-if="filters.article_id" class="muted">Un seul article · <a href="#" @click.prevent="(filters.article_id = undefined), load()">tous les articles</a></span>
    </div>
    <MovementTable :movements="movements" show-article />
    <Paginator v-if="total > 50" :rows="50" :total-records="total" @page="onPage" />
  </div>
</template>

<style scoped>
.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
</style>
