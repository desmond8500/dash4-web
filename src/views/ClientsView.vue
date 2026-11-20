<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import ToggleButton from 'primevue/togglebutton'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { ApiError, CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '@dash4/shared'
import type { Client, ClientStatus, ClientType } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ClientFormDialog from '@/components/ClientFormDialog.vue'
import ClientLogo from '@/components/ClientLogo.vue'
import { statusSeverity } from '@/utils/clients'

const auth = useAuthStore()
const toast = useToast()
const router = useRouter()

const clients = ref<Client[]>([])
const total = ref(0)
const loading = ref(false)
const filters = reactive({
  search: '',
  type: null as ClientType | null,
  status: null as ClientStatus | null,
  favorite: false,
  page: 1,
  per_page: 25,
})
const dialogOpen = ref(false)

const typeOptions = [
  { label: 'Tous les types', value: null },
  ...Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]
const statusOptions = [
  { label: 'Tous les statuts', value: null },
  ...Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.clients.list({
      search: filters.search || undefined,
      type: filters.type ?? undefined,
      status: filters.status ?? undefined,
      favorite: filters.favorite || undefined,
      page: filters.page,
      per_page: filters.per_page,
    })
    clients.value = result.data
    total.value = result.meta.total
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Chargement impossible',
      detail: e instanceof ApiError ? e.message : undefined,
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

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
watch(
  () => [filters.type, filters.status, filters.favorite],
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

function open(event: DataTableRowClickEvent): void {
  void router.push({ name: 'client', params: { id: (event.data as Client).id } })
}

function onSaved(client: Client): void {
  toast.add({ severity: 'success', summary: 'Client créé', detail: client.name, life: 3000 })
  void router.push({ name: 'client', params: { id: client.id } })
}

function onLogoFailed(message: string): void {
  toast.add({ severity: 'warn', summary: 'Client enregistré, mais pas son logo', detail: message, life: 6000 })
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Clients</h1>
      <Button v-if="auth.can('clients.create')" label="Nouveau client" icon="pi pi-plus" @click="dialogOpen = true" />
    </div>

    <div class="filters">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Rechercher un client" />
      </IconField>
      <Select v-model="filters.type" :options="typeOptions" option-label="label" option-value="value" />
      <Select v-model="filters.status" :options="statusOptions" option-label="label" option-value="value" />
      <ToggleButton v-model="filters.favorite" on-label="Favoris" off-label="Favoris" on-icon="pi pi-star-fill" off-icon="pi pi-star" />
    </div>

    <DataTable
      :value="clients"
      :loading="loading"
      lazy
      paginator
      :rows="filters.per_page"
      :total-records="total"
      :rows-per-page-options="[25, 50, 100]"
      data-key="id"
      striped-rows
      row-hover
      class="clickable"
      @page="onPage"
      @row-click="open"
    >
      <template #empty>Aucun client.</template>

      <Column header="Nom">
        <template #body="{ data }">
          <div class="identity">
            <ClientLogo :name="data.name" :url="data.logo_url" :size="36" />
            <div class="name">
              <strong>
                <i v-if="data.is_favorite" class="pi pi-star-fill favorite" aria-label="Favori" />
                {{ data.name }}
              </strong>
              <span class="muted">{{ data.address }}</span>
            </div>
          </div>
        </template>
      </Column>
      <Column header="Type">
        <template #body="{ data }">{{ data.type.label }}</template>
      </Column>
      <Column header="Téléphone">
        <template #body="{ data }">{{ data.phones?.[0]?.number }}</template>
      </Column>
      <Column header="E-mail">
        <template #body="{ data }">{{ data.emails?.[0]?.address }}</template>
      </Column>
      <Column header="Contacts" style="width: 6rem">
        <template #body="{ data }">{{ data.contacts_count ?? 0 }}</template>
      </Column>
      <Column header="Statut">
        <template #body="{ data }">
          <Tag :value="data.status.label" :severity="statusSeverity(data.status.value)" />
        </template>
      </Column>
    </DataTable>

    <ClientFormDialog v-model:visible="dialogOpen" :client="null" @saved="onSaved" @logo-failed="onLogoFailed" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.name {
  display: flex;
  flex-direction: column;
}

.favorite {
  color: var(--p-yellow-500);
  margin-right: 0.25rem;
}

.clickable :deep(tbody tr) {
  cursor: pointer;
}
</style>
