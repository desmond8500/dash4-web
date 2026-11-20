<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError, formatMoney } from '@dash4/shared'
import type { Purchase, PurchaseFilters } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import PurchaseCreateDialog from '@/components/stock/PurchaseCreateDialog.vue'
import { formatDate } from '@/utils/projects'
import { purchaseStatusSeverity } from '@/utils/stock'

const auth = useAuthStore()
const toast = useToast()
const router = useRouter()

type Scope = 'open' | 'draft' | 'received' | 'all'
const FILTER: Record<Scope, PurchaseFilters> = { open: { open: true }, draft: { status: 'draft' }, received: { status: 'received' }, all: {} }
const purchases = ref<Purchase[]>([])
const total = ref(0)
const loading = ref(false)
const createOpen = ref(false)
const filters = reactive({ scope: 'open' as Scope, search: '', page: 1, per_page: 25 })
const showCosts = auth.can('costs.view')

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.purchases.list({ ...FILTER[filters.scope], search: filters.search || undefined, page: filters.page, per_page: filters.per_page })
    purchases.value = result.data
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
const open = (event: DataTableRowClickEvent) => router.push({ name: 'purchase', params: { id: (event.data as Purchase).id } })
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Achats</h1>
      <Button v-if="auth.can('purchases.create')" label="Nouvel achat" icon="pi pi-plus" @click="createOpen = true" />
    </div>
    <div class="filters">
      <SelectButton
        v-model="filters.scope"
        :options="[{ v: 'open', l: 'À recevoir' }, { v: 'draft', l: 'Brouillons' }, { v: 'received', l: 'Reçus' }, { v: 'all', l: 'Tous' }]"
        option-label="l"
        option-value="v"
        :allow-empty="false"
      />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Numéro, objet, fournisseur" />
      </IconField>
    </div>

    <DataTable
      :value="purchases"
      :loading="loading"
      lazy
      paginator
      :rows="filters.per_page"
      :total-records="total"
      :rows-per-page-options="[25, 50, 100]"
      data-key="id"
      row-hover
      class="clickable"
      @row-click="open"
      @page="onPage"
    >
      <template #empty>Aucun achat.</template>
      <Column header="Numéro" style="width: 10rem"><template #body="{ data }"><strong>{{ data.number }}</strong></template></Column>
      <Column header="Fournisseur">
        <template #body="{ data }">
          <div class="title">
            <span>{{ data.provider?.name }}</span>
            <span class="muted">{{ [data.title, data.project?.name].filter(Boolean).join(' · ') }}</span>
          </div>
        </template>
      </Column>
      <Column header="Commandé le" style="width: 8rem"><template #body="{ data }">{{ formatDate(data.ordered_at) }}</template></Column>
      <Column header="Prévu le" style="width: 8rem">
        <template #body="{ data }"><span :class="{ late: data.is_late }">{{ formatDate(data.expected_at) }}</span></template>
      </Column>
      <Column header="Statut" style="width: 9rem">
        <template #body="{ data }">
          <Tag :value="data.is_late ? 'En retard' : data.status.label" :severity="data.is_late ? 'danger' : purchaseStatusSeverity(data.status.value)" />
        </template>
      </Column>
      <Column v-if="showCosts" header="Total" class="num" style="width: 9rem">
        <template #body="{ data }">{{ data.total !== undefined ? formatMoney(data.total) : '' }}</template>
      </Column>
    </DataTable>

    <PurchaseCreateDialog v-model:visible="createOpen" @created="(p) => router.push({ name: 'purchase', params: { id: p.id } })" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

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
