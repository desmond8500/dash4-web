<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DataTablePageEvent } from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import SelectButton from 'primevue/selectbutton'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError, CLIENT_REQUEST_SOURCE_LABELS, PRIORITY_LABELS } from '@dash4/shared'
import type { ClientRequest, ClientRequestSource, Priority } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useClientRequestsStore } from '@/stores/clientRequests'
import ClientRequestDialog from '@/components/ClientRequestDialog.vue'
import ClientRequestTable from '@/components/ClientRequestTable.vue'
import { INBOX_TABS, inboxFilters, type InboxTab, type QuickAction } from '@/utils/clientRequests'

const auth = useAuthStore()
const store = useClientRequestsStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const requests = ref<ClientRequest[]>([])
const total = ref(0)
const loading = ref(false)
const filters = reactive({
  tab: 'open' as InboxTab,
  search: '',
  priority: null as Priority | null,
  source: null as ClientRequestSource | null,
  page: 1,
  per_page: 25,
})
const dialogOpen = ref(false)
const edited = ref<ClientRequest | null>(null)

// Un technicien ne voit que ses demandes : les onglets « confiées / en retard » restent utiles au bureau
const tabs = auth.can('client_requests.update') ? INBOX_TABS : INBOX_TABS.filter((t) => t.value !== 'mine')
const priorityOptions = [
  { value: null, label: 'Toutes priorités' },
  ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
]
const sourceOptions = [
  { value: null, label: 'Toutes origines' },
  ...Object.entries(CLIENT_REQUEST_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
]

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.clientRequests.list({
      ...inboxFilters(filters.tab),
      search: filters.search || undefined,
      priority: filters.priority ?? undefined,
      source: filters.source ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    })
    requests.value = result.data
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
  () => [filters.tab, filters.priority, filters.source],
  () => {
    filters.page = 1
    void load()
  },
)
// Une demande créée avec le bouton « + Demande » apparaît tout de suite
watch(() => store.version, load)

function onPage(event: DataTablePageEvent): void {
  filters.page = event.page + 1
  filters.per_page = event.rows
  void load()
}

function open(request: ClientRequest): void {
  edited.value = request
  dialogOpen.value = true
}

async function onAction(request: ClientRequest, action: QuickAction): Promise<void> {
  try {
    await api.clientRequests.update(request.id, {
      status: action.status,
      ...(action.assignToMe && auth.user ? { assigned_to: auth.user.id } : {}),
    })
    toast.add({ severity: 'success', summary: action.label, life: 2500 })
    store.changed()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: (e as Error).message, life: 5000 })
  }
}

function onSaved(): void {
  toast.add({ severity: 'success', summary: 'Demande enregistrée', life: 2500 })
  store.changed()
}

// Ouverture directe depuis une notification : /demandes?demande=12
async function openFromQuery(): Promise<void> {
  const id = Number(route.query.demande)
  if (!id) return
  try {
    open(await api.clientRequests.get(id))
  } catch {
    toast.add({ severity: 'warn', summary: "Cette demande n'est plus disponible.", life: 4000 })
  }
  void router.replace({ query: {} })
}
watch(() => route.query.demande, openFromQuery)

onMounted(() => {
  void load()
  void openFromQuery()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Demandes clients</h1>
      <Button v-if="auth.can('client_requests.update')" label="Boîte mail" icon="pi pi-envelope" severity="secondary" @click="router.push({ name: 'inbox' })" />
      <Button
        v-if="auth.can('client_requests.create')"
        label="Nouvelle demande"
        icon="pi pi-plus"
        @click="store.openQuick()"
      />
    </div>

    <SelectButton v-model="filters.tab" :options="tabs" option-label="label" option-value="value" :allow-empty="false">
      <template #option="{ option }">
        {{ option.label }}
        <span v-if="option.value === 'open' && store.summary?.open" class="count">{{ store.summary.open }}</span>
        <span v-if="option.value === 'mine' && store.summary?.mine" class="count">{{ store.summary.mine }}</span>
        <span v-if="option.value === 'overdue' && store.summary?.overdue" class="count danger">
          {{ store.summary.overdue }}
        </span>
      </template>
    </SelectButton>

    <div class="filters">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Texte, client, nom, téléphone" />
      </IconField>
      <Select v-model="filters.priority" :options="priorityOptions" option-label="label" option-value="value" />
      <Select v-model="filters.source" :options="sourceOptions" option-label="label" option-value="value" />
    </div>

    <ClientRequestTable
      :requests="requests"
      :loading="loading"
      :total="total"
      :rows="filters.per_page"
      lazy
      @open="open"
      @action="onAction"
      @page="onPage"
    />

    <p v-if="store.summary && filters.tab === 'open'" class="muted hint">
      Une demande encore « Nouvelle » après {{ store.summary.overdue_days }} jours passe en retard et une relance est
      envoyée.
    </p>

    <ClientRequestDialog
      v-model:visible="dialogOpen"
      :request="edited"
      @saved="onSaved"
      @converted="(t) => router.push({ name: { quote: 'quote', task: 'task', project: 'project' }[t.type], params: { id: t.id } })"
    />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-size: 0.75rem;
  font-weight: 600;
}

.count.danger {
  background: var(--p-red-500);
  color: #fff;
}

.hint {
  font-size: 0.85rem;
  margin: 0;
}
</style>
