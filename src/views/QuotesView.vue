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
import { ApiError } from '@dash4/shared'
import type { Quote } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import QuoteTable from '@/components/quotes/QuoteTable.vue'
import QuoteCreateDialog from '@/components/quotes/QuoteCreateDialog.vue'

const viewMode = useViewMode('quotes')
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToast()
const router = useRouter()

type Scope = 'open' | 'accepted' | 'closed' | 'all'
const scopes = [
  { value: 'open', label: 'En cours (brouillons et envoyés)' },
  { value: 'accepted', label: 'Acceptés' },
  { value: 'closed', label: 'Refusés et annulés' },
  { value: 'all', label: 'Tous' },
]
const STATUS: Record<Scope, string | undefined> = {
  open: 'draft,sent',
  accepted: 'accepted',
  closed: 'refused,cancelled',
  all: undefined,
}

const quotes = ref<Quote[]>([])
const total = ref(0)
const loading = ref(false)
const filters = reactive({ scope: 'open' as Scope, search: '', page: 1, per_page: 25 })
const createOpen = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.quotes.list({
      status: STATUS[filters.scope],
      search: filters.search || undefined,
      page: filters.page,
      per_page: filters.per_page,
    })
    quotes.value = result.data
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
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Devis</h1>
      <ViewModeToggle v-model="viewMode" class="view-toggle" />
      <div class="header-actions">
        <Button
          v-if="auth.canAny(['quotes.create', 'quotes.update', 'quotes.update.own'])"
          label="Modèles"
          icon="pi pi-clone"
          severity="secondary"
          @click="router.push({ name: 'quote-templates' })"
        />
        <Button v-if="auth.can('quotes.create')" label="Nouveau devis" icon="pi pi-plus" @click="createOpen = true" />
      </div>
    </div>

    <div class="filters">
      <SelectButton v-model="filters.scope" :options="scopes" option-label="label" option-value="value" :allow-empty="false" />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Numéro, objet, client" />
      </IconField>
    </div>

    <QuoteTable
      :cards="viewMode === 'cards'"
      :quotes="quotes"
      :currency="settings.currency()"
      :show-prices="auth.can('prices.view')"
      :loading="loading"
      :total="total"
      :rows="filters.per_page"
      lazy
      @page="onPage"
    />

    <QuoteCreateDialog v-model:visible="createOpen" @created="(q) => router.push({ name: 'quote', params: { id: q.id } })" />
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 0.5rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
</style>
