<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DataTable, { type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { formatMoney } from '@dash4/shared'
import type { Article, ArticleFilters } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatQty, stockState } from '@/utils/stock'
import { searchOnly } from '@/utils/listSearch'
import { apiErrorMessage } from '@/utils/errors'
import ListSearch from '@/components/ListSearch.vue'

/** Articles d'une marque ou d'un fournisseur (actifs et inactifs). */
const props = defineProps<{ filters: ArticleFilters }>()
const emit = defineEmits<{ loaded: [count: number] }>()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const articles = ref<Article[]>([])
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    articles.value = (await api.articles.list({ ...props.filters, active: 'all', per_page: 100 })).data
    emit('loaded', articles.value.length)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: apiErrorMessage(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
watch(() => props.filters, load, { deep: true })
onMounted(load)
const query = ref('')
const shown = computed(() => searchOnly(articles.value, query.value, (a) => [a.designation, a.reference, a.barcode, a.brand?.name]))
const open = (e: DataTableRowClickEvent) => router.push({ name: 'article', params: { id: (e.data as Article).id } })
</script>

<template>
  <ListSearch v-if="articles.length > 8" v-model="query" class="search" placeholder="Rechercher un article (désignation, référence)…" />
  <DataTable :value="shown" :loading="loading" data-key="id" row-hover class="clickable" @row-click="open">
    <template #empty>{{ query ? 'Aucun article ne correspond.' : 'Aucun article.' }}</template>
    <Column header="" style="width: 3.5rem">
      <template #body="{ data }">
        <img v-if="data.image_url" :src="data.image_url" alt="" class="thumb" />
        <i v-else class="pi pi-box muted" />
      </template>
    </Column>
    <Column header="Article">
      <template #body="{ data }">
        <strong>{{ data.designation }}</strong>
        <div class="muted small">{{ [data.reference, data.category.label, data.is_active ? null : 'inactif'].filter(Boolean).join(' · ') }}</div>
      </template>
    </Column>
    <Column header="Stock" class="num" style="width: 8rem">
      <template #body="{ data }">{{ formatQty(data.quantity) }} {{ data.unit ?? '' }}</template>
    </Column>
    <Column header="État" style="width: 7rem">
      <template #body="{ data }"><Tag :value="stockState(data).label" :severity="stockState(data).severity" /></template>
    </Column>
    <Column v-if="auth.can('costs.view')" header="Coût" class="num" style="width: 8rem">
      <template #body="{ data }">{{ formatMoney(data.unit_cost ?? 0) }}</template>
    </Column>
    <Column v-if="auth.can('prices.view')" header="Prix de vente" class="num" style="width: 8rem">
      <template #body="{ data }">{{ formatMoney(data.unit_price ?? 0) }}</template>
    </Column>
  </DataTable>
</template>

<style scoped>
.search {
  margin-bottom: 0.75rem;
}
.clickable :deep(tbody tr) {
  cursor: pointer;
}

.thumb {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
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
