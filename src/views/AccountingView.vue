<script setup lang="ts">
import { searchOnly } from '@/utils/listSearch'
import ListSearch from '@/components/ListSearch.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Paginator, { type PageState } from 'primevue/paginator'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, formatMoney, LEDGER_SOURCE_LABELS, PAYMENT_METHODS } from '@dash4/shared'
import type { AccountingSummary, ExpenseCategory, LedgerEntry, PaymentMethod, Project, Transaction } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate, toApiDate } from '@/utils/projects'
import { barScale, monthLabel, periodLabel, periodRange, shiftPeriod, type PeriodKind } from '@/utils/accounting'

/** Bilan simple (entrées, sorties, solde), journal, transactions saisies à la main, catégories. */
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const tab = ref('summary')
const period = reactive({ kind: 'year' as PeriodKind, date: new Date(), project_id: null as number | null })
const range = computed(() => periodRange(period.kind, period.date))
const summary = ref<AccountingSummary | null>(null)
const ledger = ref<LedgerEntry[]>([])
const ledgerTotal = ref(0)
const ledgerPage = ref(1)
const ledgerDirection = ref<'all' | 'in' | 'out'>('all')
const ledgerSearch = ref('')
const projects = ref<Project[]>([])
const categories = ref<ExpenseCategory[]>([])
const transactions = ref<Transaction[]>([])
const transactionQuery = ref('')
const shownTransactions = computed(() => searchOnly(transactions.value, transactionQuery.value, (t) => [t.label, t.reference, t.project?.name, t.category?.name, t.method?.label, t.amount]))

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
const filters = () => ({ ...range.value, project_id: period.project_id ?? undefined })

async function loadSummary(): Promise<void> {
  try {
    summary.value = await api.accounting.summary(filters())
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Bilan indisponible', detail: errorDetail(e), life: 5000 })
  }
}
async function loadLedger(): Promise<void> {
  const result = await api.accounting.ledger({ ...filters(), direction: ledgerDirection.value === 'all' ? undefined : ledgerDirection.value, search: ledgerSearch.value.trim() || undefined, page: ledgerPage.value, per_page: 50 })
  ledger.value = result.data
  ledgerTotal.value = result.meta.total
}
async function loadTransactions(): Promise<void> {
  transactions.value = (await api.transactions.list({ ...filters(), per_page: 100 })).data
}
const loadCategories = async () => (categories.value = await api.expenseCategories.list(true).catch(() => []))
function reload(): void {
  ledgerPage.value = 1
  void loadSummary()
  void loadLedger()
  void loadTransactions()
}
watch(() => [period.kind, period.date, period.project_id], reload)
let ledgerTimer: ReturnType<typeof setTimeout> | undefined
watch(ledgerSearch, () => {
  clearTimeout(ledgerTimer)
  ledgerTimer = setTimeout(() => {
    ledgerPage.value = 1
    void loadLedger()
  }, 300)
})
watch(ledgerDirection, () => {
  ledgerPage.value = 1
  void loadLedger()
})
onMounted(() => {
  reload()
  void loadCategories()
  api.projects.list({ per_page: 100 }).then((r) => (projects.value = r.data)).catch(() => undefined)
})

const months = computed(() => summary.value?.by_month ?? [])
const scale = computed(() => barScale(months.value.flatMap((m) => [m.in, m.out])))
const outCategories = computed(() => (summary.value?.by_category ?? []).filter((c) => c.direction === 'out'))
const outScale = computed(() => barScale(outCategories.value.map((c) => c.amount)))

function openSource(entry: LedgerEntry): void {
  const s = entry.source
  if (s.type === 'invoice') void router.push({ name: 'invoice', params: { id: s.id } })
  else if (s.type === 'purchase') void router.push({ name: 'purchase', params: { id: s.id } })
  else if (s.type === 'expense') void router.push({ name: 'expenses' })
  else tab.value = 'transactions'
}

// Transactions
const txOpen = ref(false)
const txEdited = ref<Transaction | null>(null)
const tx = ref({ direction: 'out' as 'in' | 'out', label: '', amount: null as number | null, date: new Date() as Date | null, category: null as number | null, project: null as number | null, method: 'bank_transfer' as PaymentMethod | null, reference: '', note: '' })
const txError = ref<string | null>(null)
function openTransaction(t: Transaction | null): void {
  txEdited.value = t
  txError.value = null
  tx.value = {
    direction: t?.direction ?? 'out',
    label: t?.label ?? '',
    amount: t?.amount ?? null,
    date: t?.transacted_at ? new Date(`${t.transacted_at}T00:00:00`) : new Date(),
    category: t?.expense_category_id ?? null,
    project: t?.project_id ?? null,
    method: t?.method?.value ?? 'bank_transfer',
    reference: t?.reference ?? '',
    note: t?.note ?? '',
  }
  txOpen.value = true
}
async function saveTransaction(): Promise<void> {
  const t = tx.value
  if (!t.label.trim() || !t.amount || !t.date) {
    txError.value = 'Indiquez le libellé, le montant et la date.'
    return
  }
  const payload = {
    direction: t.direction,
    label: t.label.trim(),
    amount: t.amount,
    transacted_at: toApiDate(t.date)!,
    expense_category_id: t.category,
    project_id: t.project,
    method: t.method,
    reference: t.reference.trim() || null,
    note: t.note.trim() || null,
  }
  try {
    if (txEdited.value) await api.transactions.update(txEdited.value.id, payload)
    else await api.transactions.create({ ...payload, client_uuid: crypto.randomUUID() })
    txOpen.value = false
    reload()
  } catch (e) {
    txError.value = errorDetail(e)
  }
}
function removeTransaction(t: Transaction): void {
  confirm.require({
    header: 'Supprimer la transaction',
    message: `Supprimer « ${t.label} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.transactions.remove(t.id)
      reload()
    },
  })
}

// Catégories
const newCategory = ref('')
async function addCategory(): Promise<void> {
  try {
    await api.expenseCategories.create({ name: newCategory.value.trim() })
    newCategory.value = ''
    void loadCategories()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Catégorie refusée', detail: errorDetail(e), life: 5000 })
  }
}
async function updateCategory(c: ExpenseCategory, payload: { name?: string; is_active?: boolean }): Promise<void> {
  try {
    await api.expenseCategories.update(c.id, payload)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
  }
  void loadCategories()
}
async function removeCategory(c: ExpenseCategory): Promise<void> {
  try {
    await api.expenseCategories.remove(c.id)
    void loadCategories()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Suppression impossible', detail: errorDetail(e), life: 5000 })
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Comptabilité</h1>
      <Button v-if="auth.can('accounting.create')" label="Nouvelle transaction" icon="pi pi-plus" severity="secondary" @click="openTransaction(null)" />
    </div>

    <div class="filters">
      <SelectButton v-model="period.kind" :options="[{ v: 'month', l: 'Mois' }, { v: 'quarter', l: 'Trimestre' }, { v: 'year', l: 'Année' }]" option-label="l" option-value="v" :allow-empty="false" />
      <div class="period">
        <Button icon="pi pi-chevron-left" text rounded aria-label="Période précédente" @click="period.date = shiftPeriod(period.kind, period.date, -1)" />
        <strong>{{ periodLabel(period.kind, period.date) }}</strong>
        <Button icon="pi pi-chevron-right" text rounded aria-label="Période suivante" @click="period.date = shiftPeriod(period.kind, period.date, 1)" />
      </div>
      <Select v-model="period.project_id" :options="[{ id: null, name: 'Tous les projets' }, ...projects]" option-label="name" option-value="id" filter />
    </div>

    <div v-if="summary" class="kpis">
      <div class="kpi"><span class="muted">Entrées</span><strong class="in">{{ formatMoney(summary.in) }}</strong></div>
      <div class="kpi"><span class="muted">Sorties</span><strong class="out">{{ formatMoney(summary.out) }}</strong></div>
      <div class="kpi"><span class="muted">Solde de la période</span><strong :class="summary.net < 0 ? 'out' : 'in'">{{ formatMoney(summary.net) }}</strong></div>
    </div>

    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="summary">Bilan</Tab>
        <Tab value="ledger">Journal</Tab>
        <Tab value="transactions">Transactions <span v-if="transactions.length" class="count">{{ transactions.length }}</span></Tab>
        <Tab value="categories">Catégories</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="summary">
          <div v-if="summary" class="grid">
            <Card>
              <template #title>Par mois</template>
              <template #content>
                <div v-if="months.length" class="chart">
                  <div v-for="m in months" :key="m.month" class="month">
                    <div class="bars">
                      <div class="bar in" :style="{ height: `${scale(m.in)}%` }" :title="`Entrées : ${formatMoney(m.in)}`" />
                      <div class="bar out" :style="{ height: `${scale(m.out)}%` }" :title="`Sorties : ${formatMoney(m.out)}`" />
                    </div>
                    <small>{{ monthLabel(m.month) }}</small>
                  </div>
                </div>
                <p v-else class="muted">Aucun mouvement sur la période.</p>
                <p class="legend small"><span class="dot in" /> Entrées <span class="dot out" /> Sorties</p>
              </template>
            </Card>
            <Card>
              <template #title>Sorties par catégorie</template>
              <template #content>
                <div v-for="c in outCategories" :key="c.category" class="cat">
                  <div class="cat-head"><span>{{ c.category }}</span><strong>{{ formatMoney(c.amount) }}</strong></div>
                  <div class="track"><div class="fill" :style="{ width: `${outScale(c.amount)}%` }" /></div>
                </div>
                <p v-if="!outCategories.length" class="muted">Aucune sortie.</p>
              </template>
            </Card>
            <Card>
              <template #title>Par origine</template>
              <template #content>
                <table class="list">
                  <thead><tr><th>Origine</th><th class="num">Entrées</th><th class="num">Sorties</th></tr></thead>
                  <tbody>
                    <tr v-for="s in summary.by_source" :key="s.source">
                      <td>{{ LEDGER_SOURCE_LABELS[s.source] }}</td>
                      <td class="num">{{ s.in ? formatMoney(s.in) : '' }}</td>
                      <td class="num">{{ s.out ? formatMoney(s.out) : '' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p class="muted small">Entrées : paiements de factures et transactions. Sorties : dépenses validées, achats reçus (TVA comprise) et transactions. Les versements dans les caisses ne comptent pas (mouvements internes).</p>
              </template>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="ledger">
          <div class="list-tools">
            <SelectButton v-model="ledgerDirection" :options="[{ v: 'all', l: 'Tout' }, { v: 'in', l: 'Entrées' }, { v: 'out', l: 'Sorties' }]" option-label="l" option-value="v" :allow-empty="false" />
            <ListSearch v-model="ledgerSearch" placeholder="Libellé, client, catégorie, projet…" />
          </div>
          <table v-if="ledger.length" class="list">
            <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Projet</th><th class="num">Montant</th></tr></thead>
            <tbody>
              <tr v-for="(e, i) in ledger" :key="`${e.source.type}-${e.source.id}-${i}`" class="clickable" @click="openSource(e)">
                <td>{{ formatDate(e.date) }}</td>
                <td>{{ e.label }}<div class="muted small">{{ LEDGER_SOURCE_LABELS[e.source.type] }}</div></td>
                <td>{{ e.category ?? '' }}</td>
                <td>{{ e.project?.name ?? '' }}</td>
                <td class="num" :class="e.direction">{{ e.direction === 'in' ? '+' : '−' }} {{ formatMoney(e.amount) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted">Aucun mouvement sur la période.</p>
          <Paginator v-if="ledgerTotal > 50" :rows="50" :total-records="ledgerTotal" @page="(e: PageState) => ((ledgerPage = e.page + 1), loadLedger())" />
        </TabPanel>

        <TabPanel value="transactions">
          <p class="muted small">Entrées et sorties qui ne viennent ni d'une facture, ni d'une dépense, ni d'un achat : apport, emprunt, salaires, loyer, impôts…</p>
          <ListSearch v-if="transactions.length > 5" v-model="transactionQuery" class="search" placeholder="Libellé, référence, projet, catégorie…" />
          <table v-if="shownTransactions.length" class="list">
            <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Moyen</th><th class="num">Montant</th><th /></tr></thead>
            <tbody>
              <tr v-for="t in shownTransactions" :key="t.id">
                <td>{{ formatDate(t.transacted_at) }}</td>
                <td>{{ t.label }}<div v-if="t.reference || t.project" class="muted small">{{ [t.reference, t.project?.name].filter(Boolean).join(' · ') }}</div></td>
                <td>{{ t.category?.name ?? '' }}</td>
                <td>{{ t.method?.label ?? '' }}</td>
                <td class="num" :class="t.direction">{{ t.direction === 'in' ? '+' : '−' }} {{ formatMoney(t.amount) }}</td>
                <td class="actions">
                  <Button v-if="auth.can('accounting.update')" icon="pi pi-pencil" text rounded aria-label="Modifier" @click="openTransaction(t)" />
                  <Button v-if="auth.can('accounting.delete')" icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="removeTransaction(t)" />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted">{{ transactionQuery.trim() && transactions.length ? 'Aucune transaction ne correspond.' : 'Aucune transaction sur la période.' }}</p>
        </TabPanel>

        <TabPanel value="categories">
          <div class="panel">
            <table class="list">
              <thead><tr><th>Catégorie</th><th class="num">Dépenses</th><th>Active</th><th /></tr></thead>
              <tbody>
                <tr v-for="c in categories" :key="c.id">
                  <td>
                    <InputText v-if="auth.can('accounting.update')" :model-value="c.name" @change="updateCategory(c, { name: ($event.target as HTMLInputElement).value.trim() || c.name })" />
                    <template v-else>{{ c.name }}</template>
                  </td>
                  <td class="num">{{ c.expenses_count }}</td>
                  <td><ToggleSwitch :model-value="c.is_active" :disabled="!auth.can('accounting.update')" @update:model-value="(v: boolean) => updateCategory(c, { is_active: v })" /></td>
                  <td>
                    <Button v-if="auth.can('accounting.delete') && !c.expenses_count" icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="removeCategory(c)" />
                  </td>
                </tr>
              </tbody>
            </table>
            <form v-if="auth.can('accounting.update')" class="add" @submit.prevent="addCategory">
              <InputText v-model="newCategory" placeholder="Nouvelle catégorie" />
              <Button type="submit" label="Ajouter" icon="pi pi-plus" size="small" :disabled="!newCategory.trim()" />
            </form>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <Dialog v-model:visible="txOpen" :header="txEdited ? 'Modifier la transaction' : 'Nouvelle transaction'" modal :style="{ width: '560px' }" :breakpoints="{ '600px': '95vw' }">
      <form id="tx-form" class="form-grid" @submit.prevent="saveTransaction">
        <Message v-if="txError" class="form-field--full" severity="error" :closable="false">{{ txError }}</Message>
        <div class="form-field form-field--full">
          <SelectButton v-model="tx.direction" :options="[{ v: 'in', l: 'Entrée' }, { v: 'out', l: 'Sortie' }]" option-label="l" option-value="v" :allow-empty="false" />
        </div>
        <div class="form-field form-field--full"><label for="t-label">Libellé</label><InputText id="t-label" v-model="tx.label" placeholder="Ex. : loyer novembre, salaires, apport" /></div>
        <div class="form-field"><label for="t-amount">Montant</label><InputNumber v-model="tx.amount" input-id="t-amount" :min="1" suffix=" F CFA" /></div>
        <div class="form-field"><label for="t-date">Date</label><DatePicker v-model="tx.date" input-id="t-date" date-format="dd/mm/yy" /></div>
        <div class="form-field"><label for="t-cat">Catégorie</label><Select id="t-cat" v-model="tx.category" :options="[{ id: null, name: 'Aucune' }, ...categories.filter((c) => c.is_active)]" option-label="name" option-value="id" /></div>
        <div class="form-field"><label for="t-method">Moyen</label><Select id="t-method" v-model="tx.method" :options="PAYMENT_METHODS" option-label="label" option-value="value" /></div>
        <div class="form-field"><label for="t-project">Projet</label><Select id="t-project" v-model="tx.project" :options="[{ id: null, name: 'Aucun' }, ...projects]" option-label="name" option-value="id" filter /></div>
        <div class="form-field"><label for="t-ref">Référence</label><InputText id="t-ref" v-model="tx.reference" /></div>
        <div class="form-field form-field--full"><label for="t-note">Note</label><InputText id="t-note" v-model="tx.note" /></div>
      </form>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="txOpen = false" />
        <Button label="Enregistrer" icon="pi pi-check" type="submit" form="tx-form" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.list-tools {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 0.75rem;
}
.search {
  margin-bottom: 0.75rem;
}
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.period {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 14rem;
  justify-content: center;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
}

.kpi strong {
  font-size: 1.4rem;
}

.in {
  color: var(--p-green-600);
}

.out {
  color: var(--p-red-500);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 1rem;
}

.chart {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  height: 200px;
  overflow-x: auto;
}

.month {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 2.5rem;
  height: 100%;
}

.bars {
  flex: 1;
  display: flex;
  gap: 2px;
  align-items: flex-end;
  width: 100%;
  justify-content: center;
}

.bar {
  width: 40%;
  max-width: 1.25rem;
  min-height: 1px;
  border-radius: 3px 3px 0 0;
}

.bar.in,
.dot.in,
.fill {
  background: var(--p-green-500);
}

.bar.out,
.dot.out {
  background: var(--p-red-400);
}

.fill {
  background: var(--p-primary-color);
}

.legend {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.dot {
  display: inline-block;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
  margin-left: 0.5rem;
}

.cat {
  margin-bottom: 0.625rem;
}

.cat-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.track {
  height: 0.5rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
}

.fill {
  height: 100%;
  border-radius: 999px;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}

.mb {
  margin-bottom: 0.75rem;
}

tr.clickable {
  cursor: pointer;
}

.actions {
  white-space: nowrap;
}

.small {
  font-size: 0.8rem;
}

td.num,
th.num {
  text-align: right;
  white-space: nowrap;
}
</style>
