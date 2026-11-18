<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { DataTablePageEvent } from 'primevue/datatable'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import { ApiError, formatMoney } from '@dash4/shared'
import type { Expense, ExpenseFilters, ExpenseSpace, ExpenseSummary } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ExpenseDialog from '@/components/accounting/ExpenseDialog.vue'
import ExpenseTable from '@/components/accounting/ExpenseTable.vue'

const auth = useAuthStore()
const toast = useToast()
const router = useRouter()
const isAccountant = computed(() => auth.can('accounting.view'))

type Scope = 'to_approve' | 'to_reimburse' | 'mine' | 'all'
const scopes = computed(() => [
  ...(isAccountant.value ? [{ value: 'to_approve', label: 'À valider' }, { value: 'to_reimburse', label: 'À rembourser' }] : []),
  { value: 'mine', label: 'Mes dépenses' },
  { value: 'all', label: isAccountant.value ? 'Toutes' : 'Mes caisses comprises' },
])
const FILTER: Record<Scope, ExpenseFilters> = {
  to_approve: { status: 'submitted' },
  to_reimburse: { to_reimburse: true },
  mine: { mine: true },
  all: {},
}

const tab = ref('expenses')
const expenses = ref<Expense[]>([])
const spaces = ref<ExpenseSpace[]>([])
const summary = ref<ExpenseSummary | null>(null)
const total = ref(0)
const loading = ref(false)
const filters = reactive({ scope: (isAccountant.value ? 'to_approve' : 'mine') as Scope, search: '', page: 1 })
const dialogOpen = ref(false)
const selected = ref<Expense | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.expenses.list({ ...FILTER[filters.scope], search: filters.search || undefined, page: filters.page, per_page: 50 })
    expenses.value = result.data
    total.value = result.meta.total
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: e instanceof ApiError ? e.message : undefined, life: 5000 })
  } finally {
    loading.value = false
  }
}
const loadSummary = () => api.expenses.summary().then((s) => (summary.value = s)).catch(() => undefined)
const loadSpaces = () => api.expenseSpaces.list().then((s) => (spaces.value = s)).catch(() => undefined)

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
const onPage = (e: DataTablePageEvent) => {
  filters.page = e.page + 1
  void load()
}
function open(expense: Expense | null): void {
  selected.value = expense
  dialogOpen.value = true
}
function onSaved(): void {
  void load()
  void loadSummary()
  void loadSpaces()
}

// Nouvelle caisse
const spaceOpen = ref(false)
const spaceName = ref('')
async function createSpace(): Promise<void> {
  try {
    const space = await api.expenseSpaces.create({ name: spaceName.value.trim() })
    spaceOpen.value = false
    void router.push({ name: 'expense-space', params: { id: space.id } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Création impossible', detail: (e as Error).message, life: 5000 })
  }
}

onMounted(() => void Promise.all([load(), loadSummary(), loadSpaces()]))
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Dépenses</h1>
      <div class="actions">
        <Button v-if="auth.can('accounting.create') && tab === 'spaces'" label="Nouvelle caisse" icon="pi pi-plus" severity="secondary" @click="(spaceName = ''), (spaceOpen = true)" />
        <Button v-if="auth.canAny(['accounting.create', 'accounting.create.own'])" label="Nouvelle dépense" icon="pi pi-plus" @click="open(null)" />
      </div>
    </div>

    <div v-if="summary" class="kpis">
      <button v-if="isAccountant" type="button" class="kpi" :class="{ alert: summary.to_approve_count }" @click="(tab = 'expenses'), (filters.scope = 'to_approve')">
        <span class="muted">À valider</span><strong>{{ formatMoney(summary.to_approve_amount) }}</strong><small class="muted">{{ summary.to_approve_count }} dépense(s)</small>
      </button>
      <button type="button" class="kpi" @click="isAccountant ? ((tab = 'expenses'), (filters.scope = 'to_reimburse')) : undefined">
        <span class="muted">À rembourser</span><strong>{{ formatMoney(summary.to_reimburse_amount) }}</strong><small class="muted">{{ summary.to_reimburse_count }} dépense(s)</small>
      </button>
      <div class="kpi"><span class="muted">Validées ce mois-ci</span><strong>{{ formatMoney(summary.this_month) }}</strong></div>
    </div>

    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="expenses">Dépenses</Tab>
        <Tab value="spaces">Caisses <span v-if="spaces.length" class="count">{{ spaces.length }}</span></Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="expenses">
          <div class="filters">
            <SelectButton v-model="filters.scope" :options="scopes" option-label="label" option-value="value" :allow-empty="false" />
            <IconField>
              <InputIcon class="pi pi-search" />
              <InputText v-model="filters.search" placeholder="Libellé" />
            </IconField>
          </div>
          <ExpenseTable :expenses="expenses" :loading="loading" lazy :total="total" @open="open" @page="onPage" />
        </TabPanel>
        <TabPanel value="spaces">
          <div v-if="spaces.length" class="spaces">
            <button v-for="s in spaces" :key="s.id" type="button" class="space" @click="router.push({ name: 'expense-space', params: { id: s.id } })">
              <strong>{{ s.name }}</strong>
              <span class="balance" :class="{ negative: s.balance < 0 }">{{ formatMoney(s.balance) }}</span>
              <small class="muted">Versé {{ formatMoney(s.funded) }} · dépensé {{ formatMoney(s.spent) }}</small>
              <small class="muted">{{ s.members.map((m) => m.full_name).join(', ') || 'Aucun membre' }}</small>
            </button>
          </div>
          <p v-else class="muted">Aucune caisse{{ isAccountant ? '' : ' dont vous êtes membre' }}.</p>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <ExpenseDialog v-model:visible="dialogOpen" :expense="selected" @saved="onSaved" @removed="onSaved" />

    <Dialog v-model:visible="spaceOpen" header="Nouvelle caisse" modal :style="{ width: '420px' }">
      <form id="space-form" @submit.prevent="createSpace">
        <InputText v-model="spaceName" placeholder="Ex. : caisse chantier, petite caisse" fluid autofocus />
      </form>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="spaceOpen = false" />
        <Button label="Créer" icon="pi pi-check" type="submit" form="space-form" :disabled="!spaceName.trim()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.5rem;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.kpi,
.space {
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

button.kpi,
.space {
  cursor: pointer;
}

.kpi strong {
  font-size: 1.25rem;
}

.kpi.alert strong {
  color: var(--p-orange-500);
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 0.75rem;
}

.spaces {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.balance {
  font-size: 1.5rem;
  font-weight: 700;
}

.negative {
  color: var(--p-red-500);
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}
</style>
