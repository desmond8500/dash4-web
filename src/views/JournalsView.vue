<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { DataTablePageEvent } from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import { JOURNAL_TYPES } from '@dash4/shared'
import type { Journal, JournalType } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import JournalCreateDialog from '@/components/journals/JournalCreateDialog.vue'
import JournalTable from '@/components/journals/JournalTable.vue'

const auth = useAuthStore()
const router = useRouter()
const journals = ref<Journal[]>([])
const total = ref(0)
const loading = ref(false)
const createOpen = ref(false)
const filters = reactive({ search: '', type: null as JournalType | null, mine: false, page: 1 })

async function load(): Promise<void> {
  loading.value = true
  try {
    const r = await api.journals.list({ search: filters.search || undefined, type: filters.type ?? undefined, mine: filters.mine, page: filters.page, per_page: 50 })
    journals.value = r.data
    total.value = r.meta.total
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
  () => [filters.type, filters.mine],
  () => {
    filters.page = 1
    void load()
  },
)
function onPage(e: DataTablePageEvent): void {
  filters.page = e.page + 1
  void load()
}
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Journaux d'intervention</h1>
      <Button v-if="auth.can('journals.create')" label="Nouveau journal" icon="pi pi-plus" @click="createOpen = true" />
    </div>
    <div class="filters">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Titre" />
      </IconField>
      <Select v-model="filters.type" :options="[{ value: null, label: 'Tous les types' }, ...JOURNAL_TYPES]" option-label="label" option-value="value" />
      <label class="switch"><ToggleSwitch v-model="filters.mine" /> Les miens</label>
    </div>
    <JournalTable :journals="journals" :loading="loading" lazy :total="total" @page="onPage" />
    <JournalCreateDialog v-model:visible="createOpen" @created="(j) => router.push({ name: 'journal', params: { id: j.id } })" />
  </div>
</template>

<style scoped>
.filters,
.switch {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.switch {
  gap: 0.5rem;
}
</style>
