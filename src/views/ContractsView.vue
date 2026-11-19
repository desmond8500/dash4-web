<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import AutoComplete from 'primevue/autocomplete'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { ApiError, BILLING_PERIODS, formatMoney } from '@dash4/shared'
import type { BillingPeriod, Contract } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, toApiDate } from '@/utils/projects'
import { contractSeverity } from '@/utils/contracts'
import FlatRatesDialog from '@/components/contracts/FlatRatesDialog.vue'

/** Contrats de maintenance : à facturer, échéances proches, création. */
const auth = useAuthStore()
const settings = useSettingsStore()
const router = useRouter()

const contracts = ref<Contract[]>([])
const loading = ref(false)
const route = useRoute()
const filter = ref<'all' | 'due' | 'ending' | 'active'>(route.query.filtre === 'due' ? 'due' : 'all')
const search = ref('')
const ratesOpen = ref(false)
const createOpen = ref(false)
const client = ref<{ id: number; name: string } | null>(null)
const clients = ref<Array<{ id: number; name: string }>>([])
const form = ref({ title: 'Contrat de maintenance', start: new Date() as Date | null, end: null as Date | null, period: 'monthly' as BillingPeriod })
const error = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    contracts.value = (await api.contracts.list({
      search: search.value || undefined,
      due: filter.value === 'due',
      ending: filter.value === 'ending',
      status: filter.value === 'active' ? 'active' : undefined,
      per_page: 200,
    })).data
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  void settings.load()
  void load()
})
watch(filter, load)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})

async function searchClients(e: { query: string }): Promise<void> {
  clients.value = (await api.clients.list({ search: e.query, per_page: 10 })).data.map((c) => ({ id: c.id, name: c.name }))
}
async function create(): Promise<void> {
  if (!client.value || !form.value.title.trim() || !form.value.start) return void (error.value = 'Choisissez le client, le titre et la date de début.')
  try {
    const c = await api.contracts.create({
      client_id: client.value.id, title: form.value.title.trim(), start_date: toApiDate(form.value.start)!, end_date: toApiDate(form.value.end), billing_period: form.value.period,
    })
    createOpen.value = false
    void router.push({ name: 'contract', params: { id: c.id } })
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Contrats</h1>
      <Button label="Forfaits" icon="pi pi-list" text @click="ratesOpen = true" />
      <Button v-if="auth.can('contracts.create')" label="Nouveau contrat" icon="pi pi-plus" @click="createOpen = true" />
    </div>
    <div class="filters">
      <SelectButton v-model="filter" :options="[{ v: 'all', l: 'Tous' }, { v: 'active', l: 'En cours' }, { v: 'due', l: 'À facturer' }, { v: 'ending', l: 'Échéance proche' }]" option-label="l" option-value="v" :allow-empty="false" />
      <InputText v-model="search" placeholder="Rechercher (titre, numéro)" />
    </div>
    <DataTable :value="contracts" :loading="loading" data-key="id" row-hover class="clickable" @row-click="(e) => router.push({ name: 'contract', params: { id: e.data.id } })">
      <template #empty>Aucun contrat.</template>
      <Column header="Contrat"><template #body="{ data }"><strong>{{ data.title }}</strong><div class="muted small">{{ data.number }}</div></template></Column>
      <Column header="Client"><template #body="{ data }">{{ data.client?.name }}</template></Column>
      <Column header="Période"><template #body="{ data }">{{ formatDate(data.start_date) }} → {{ data.end_date ? formatDate(data.end_date) : '…' }}<div v-if="data.tacit_renewal" class="muted small">Reconduction tacite</div></template></Column>
      <Column header="Facturation">
        <template #body="{ data }">
          {{ data.billing_period.label }}<template v-if="data.period_amount !== undefined"> · {{ formatMoney(data.period_amount, settings.currency()) }}</template>
          <div class="muted small">Prochaine : {{ formatDate(data.next_invoice_date) }}</div>
        </template>
      </Column>
      <Column header="Statut">
        <template #body="{ data }">
          <Tag :value="data.invoice_due ? 'À facturer' : data.ends_soon ? 'Échéance proche' : data.status.label" :severity="contractSeverity(data)" />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="createOpen" header="Nouveau contrat" modal :style="{ width: '520px' }">
      <form id="contract-new" class="form-grid" @submit.prevent="create">
        <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
        <div class="form-field form-field--full"><label for="ct-client">Client</label><AutoComplete v-model="client" input-id="ct-client" :suggestions="clients" option-label="name" force-selection placeholder="Rechercher un client" @complete="searchClients" /></div>
        <div class="form-field form-field--full"><label for="ct-title">Titre</label><InputText id="ct-title" v-model="form.title" /></div>
        <div class="form-field"><label for="ct-start">Début</label><DatePicker v-model="form.start" input-id="ct-start" date-format="dd/mm/yy" /></div>
        <div class="form-field"><label for="ct-end">Échéance</label><DatePicker v-model="form.end" input-id="ct-end" date-format="dd/mm/yy" show-button-bar /></div>
        <div class="form-field"><label for="ct-period">Facturation</label><Select id="ct-period" v-model="form.period" :options="BILLING_PERIODS" option-label="label" option-value="value" /></div>
      </form>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="createOpen = false" />
        <Button label="Créer" icon="pi pi-check" type="submit" form="contract-new" />
      </template>
    </Dialog>
    <FlatRatesDialog v-model:visible="ratesOpen" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.small {
  font-size: 0.85rem;
}

:deep(.clickable tbody tr) {
  cursor: pointer;
}
</style>
