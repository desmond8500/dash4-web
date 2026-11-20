<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, formatMoney, PAYMENT_METHODS } from '@dash4/shared'
import type { Assignee, Expense, ExpenseSpace, PaymentMethod } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ExpenseDialog from '@/components/accounting/ExpenseDialog.vue'
import ExpenseTable from '@/components/accounting/ExpenseTable.vue'
import { formatDate, toApiDate } from '@/utils/projects'

/** Caisse : solde, versements, membres et dépenses. */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const space = ref<ExpenseSpace | null>(null)
const expenses = ref<Expense[]>([])
const people = ref<Assignee[]>([])
const memberIds = ref<number[]>([])
const loading = ref(true)
const notFound = ref(false)
const dialogOpen = ref(false)
const selected = ref<Expense | null>(null)
const funding = ref({ amount: null as number | null, date: new Date() as Date | null, method: 'cash' as PaymentMethod, note: '' })

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

function setSpace(s: ExpenseSpace): void {
  space.value = s
  memberIds.value = s.members.map((m) => m.id)
}

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    setSpace(await api.expenseSpaces.get(Number(props.id)))
    expenses.value = (await api.expenses.list({ expense_space_id: Number(props.id), per_page: 100 })).data
    if (space.value?.can.update && !people.value.length) people.value = await api.assignees.list().catch(() => [])
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

async function update(payload: Parameters<typeof api.expenseSpaces.update>[1]): Promise<void> {
  try {
    setSpace(await api.expenseSpaces.update(space.value!.id, payload))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
  }
}
async function addFunding(): Promise<void> {
  const f = funding.value
  if (!f.amount) return
  try {
    setSpace(await api.expenseSpaces.fund(space.value!.id, { amount: f.amount, funded_at: toApiDate(f.date) ?? undefined, method: f.method, note: f.note.trim() || null }))
    funding.value = { ...f, amount: null, note: '' }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Versement refusé', detail: errorDetail(e), life: 5000 })
  }
}
function removeFunding(id: number): void {
  confirm.require({
    header: 'Retirer le versement',
    message: 'Retirer ce versement ? Le solde sera recalculé.',
    acceptProps: { label: 'Retirer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => setSpace(await api.expenseSpaces.removeFunding(id)),
  })
}
function open(expense: Expense | null): void {
  selected.value = expense
  dialogOpen.value = true
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !space" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Cette caisse n'existe pas, ou vous n'en êtes pas membre.</p>
      <RouterLink :to="{ name: 'expenses' }">Retour aux dépenses</RouterLink>
    </div>

    <template v-else-if="space">
      <RouterLink :to="{ name: 'expenses' }" class="back"><i class="pi pi-arrow-left" /> Dépenses</RouterLink>
      <div class="page-header">
        <h1>
          <InputText v-if="space.can.update" :model-value="space.name" class="title-input" @change="update({ name: ($event.target as HTMLInputElement).value.trim() || space.name })" />
          <template v-else>{{ space.name }}</template>
        </h1>
        <Button v-if="auth.canAny(['accounting.create', 'accounting.create.own'])" label="Nouvelle dépense" icon="pi pi-plus" @click="open(null)" />
      </div>

      <div class="kpis">
        <div class="kpi"><span class="muted">Solde</span><strong :class="{ negative: space.balance < 0 }">{{ formatMoney(space.balance) }}</strong></div>
        <div class="kpi"><span class="muted">Versé</span><strong>{{ formatMoney(space.funded) }}</strong></div>
        <div class="kpi"><span class="muted">Dépensé</span><strong>{{ formatMoney(space.spent) }}</strong><small v-if="space.pending" class="muted">dont {{ formatMoney(space.pending) }} à valider</small></div>
      </div>

      <div class="layout">
        <Card>
          <template #title>Dépenses de la caisse</template>
          <template #content>
            <ExpenseTable :expenses="expenses" hide-space @open="open" />
            <p class="muted small">Les dépenses « avancées » par une personne ne sortent pas de la caisse : elles lui sont remboursées.</p>
          </template>
        </Card>

        <div class="side">
          <Card>
            <template #title>Versements</template>
            <template #content>
              <table v-if="space.fundings?.length" class="list">
                <tbody>
                  <tr v-for="f in space.fundings" :key="f.id">
                    <td>{{ formatDate(f.funded_at) }}<div class="muted small">{{ [f.method?.label, f.note].filter(Boolean).join(' · ') }}</div></td>
                    <td class="num">{{ formatMoney(f.amount) }}</td>
                    <td v-if="space.can.delete"><Button icon="pi pi-times" text rounded severity="danger" aria-label="Retirer" @click="removeFunding(f.id)" /></td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="muted">Aucun versement.</p>
              <form v-if="space.can.fund" class="fund" @submit.prevent="addFunding">
                <InputNumber v-model="funding.amount" :min="1" suffix=" F CFA" placeholder="Montant" fluid />
                <div class="row">
                  <DatePicker v-model="funding.date" date-format="dd/mm/yy" :max-date="new Date()" />
                  <Select v-model="funding.method" :options="PAYMENT_METHODS" option-label="label" option-value="value" />
                </div>
                <InputText v-model="funding.note" placeholder="Note (facultatif)" />
                <Button type="submit" label="Ajouter le versement" icon="pi pi-plus" size="small" :disabled="!funding.amount" />
              </form>
            </template>
          </Card>

          <Card>
            <template #title>Membres</template>
            <template #content>
              <MultiSelect
                v-if="space.can.update"
                v-model="memberIds"
                :options="people"
                option-label="full_name"
                option-value="id"
                filter
                display="chip"
                placeholder="Choisir les membres"
                fluid
                @hide="update({ member_ids: memberIds })"
              />
              <ul v-else class="members">
                <li v-for="m in space.members" :key="m.id">{{ m.full_name }}</li>
              </ul>
              <p class="muted small">Les membres voient la caisse et y rattachent leurs dépenses.</p>
              <label v-if="space.can.update" class="switch">
                <ToggleSwitch :model-value="space.is_active" @update:model-value="(v: boolean) => update({ is_active: v })" /> Caisse active
              </label>
            </template>
          </Card>
        </div>
      </div>

      <ExpenseDialog v-model:visible="dialogOpen" :expense="selected" :space-id="space.id" @saved="load" @removed="load" />
    </template>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.title-input {
  font-size: 1.5rem;
  font-weight: 700;
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

.negative {
  color: var(--p-red-500);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fund {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.row {
  display: flex;
  gap: 0.5rem;
}

.members {
  margin: 0;
  padding-left: 1.25rem;
}

.switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.small {
  font-size: 0.8rem;
}

td.num {
  text-align: right;
  white-space: nowrap;
}
</style>
