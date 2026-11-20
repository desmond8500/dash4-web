<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, BILLING_PERIODS, CONTRACT_STATUSES, formatMoney } from '@dash4/shared'
import type { BillingPeriod, Contract, ContractLine, ContractStatus, FlatRate } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { contractSeverity, linesTotal, yearlyAmount } from '@/utils/contracts'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import CommentsPanel from '@/components/CommentsPanel.vue'

/** Fiche d'un contrat : conditions, lignes (forfaits), factures par période, PDF. */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const settings = useSettingsStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const contract = ref<Contract | null>(null)
const rates = ref<FlatRate[]>([])
const saving = ref(false)
const invoicing = ref(false)
const tab = ref('lines')
const form = ref({
  title: '', status: 'draft' as ContractStatus, start: null as Date | null, end: null as Date | null, tacit: false, period: 'monthly' as BillingPeriod,
  next: null as Date | null, visits: 0, notice: 30, description: '', terms: '',
})
const lines = ref<Array<Pick<ContractLine, 'flat_rate_id' | 'designation' | 'unit' | 'quantity'> & { unit_price: number | undefined }>>([])

const canPrices = computed(() => auth.can('prices.view'))
const editable = computed(() => !!contract.value?.can.update)
const money = (v: number) => formatMoney(v, settings.currency())
const total = computed(() => linesTotal(lines.value))
const months = computed(() => BILLING_PERIODS.find((p) => p.value === form.value.period)?.months ?? 1)
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

function set(c: Contract): void {
  contract.value = c
  form.value = {
    title: c.title, status: c.status.value, start: fromApiDate(c.start_date), end: fromApiDate(c.end_date), tacit: c.tacit_renewal, period: c.billing_period.value,
    next: fromApiDate(c.next_invoice_date), visits: c.visits_per_year, notice: c.notice_days, description: c.description ?? '', terms: c.terms ?? '',
  }
  lines.value = (c.lines ?? []).map((l) => ({ flat_rate_id: l.flat_rate_id, designation: l.designation, unit: l.unit, quantity: l.quantity, unit_price: l.unit_price }))
}
async function load(): Promise<void> {
  set(await api.contracts.get(Number(props.id)))
  rates.value = await api.contracts.flatRates(contract.value?.client_id).catch(() => [])
}
onMounted(() => {
  void settings.load()
  void load()
})
watch(() => props.id, load)

function pickRate(i: number): void {
  const line = lines.value[i]
  const rate = rates.value.find((r) => r.id === line?.flat_rate_id)
  if (!line || !rate) return
  line.designation = rate.designation
  line.unit = rate.unit
  if (rate.price !== undefined) line.unit_price = rate.price
}

async function save(): Promise<void> {
  if (!contract.value) return
  saving.value = true
  try {
    const f = form.value
    set(await api.contracts.update(contract.value.id, {
      title: f.title.trim(), status: f.status, start_date: toApiDate(f.start) ?? undefined, end_date: toApiDate(f.end), tacit_renewal: f.tacit,
      billing_period: f.period, next_invoice_date: toApiDate(f.next), visits_per_year: f.visits, notice_days: f.notice,
      description: f.description.trim() || null, terms: f.terms.trim() || null,
      lines: lines.value.filter((l) => l.flat_rate_id || l.designation.trim()).map((l) => ({
        flat_rate_id: l.flat_rate_id, designation: l.designation, unit: l.unit, quantity: l.quantity, ...(canPrices.value ? { unit_price: l.unit_price ?? 0 } : {}),
      })),
    }))
    toast.add({ severity: 'success', summary: 'Contrat enregistré', life: 2500 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: errorDetail(e), life: 6000 })
  } finally {
    saving.value = false
  }
}

async function invoice(): Promise<void> {
  if (!contract.value) return
  invoicing.value = true
  try {
    const inv = await api.contracts.invoice(contract.value.id)
    toast.add({ severity: 'success', summary: 'Facture créée', detail: inv.title, life: 3000 })
    void router.push({ name: 'invoice', params: { id: inv.id } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Facturation impossible', detail: errorDetail(e), life: 6000 })
  } finally {
    invoicing.value = false
  }
}
async function pdf(): Promise<void> {
  if (!contract.value) return
  const url = URL.createObjectURL(await api.contracts.pdf(contract.value.id))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
function remove(): void {
  if (!contract.value) return
  confirm.require({
    header: 'Supprimer le contrat',
    message: `Supprimer « ${contract.value.title} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.contracts.remove(contract.value!.id)
      void router.push({ name: 'contracts' })
    },
  })
}
</script>

<template>
  <div v-if="!contract" class="center"><ProgressSpinner /></div>
  <div v-else class="page">
    <div class="page-header">
      <div>
        <h1>{{ contract.title }}</h1>
        <p class="muted">{{ contract.number }} · <router-link :to="{ name: 'client', params: { id: contract.client_id } }">{{ contract.client?.name }}</router-link></p>
      </div>
      <Tag :value="contract.invoice_due ? 'À facturer' : contract.ends_soon ? 'Échéance proche' : contract.status.label" :severity="contractSeverity(contract)" />
      <span class="grow" />
      <Button v-if="canPrices" label="PDF" icon="pi pi-file-pdf" severity="secondary" text @click="pdf" />
      <Button v-if="contract.can.invoice && contract.status.value === 'active'" label="Facturer la période" icon="pi pi-receipt" severity="secondary" :loading="invoicing" @click="invoice" />
      <Button v-if="editable" label="Enregistrer" icon="pi pi-check" :loading="saving" @click="save" />
      <Button v-if="contract.can.delete" icon="pi pi-trash" text severity="danger" aria-label="Supprimer" @click="remove" />
    </div>

    <Card>
      <template #content>
        <div class="form-grid">
          <div class="form-field form-field--full"><label for="c-title">Titre</label><InputText id="c-title" v-model="form.title" :disabled="!editable" /></div>
          <div class="form-field"><label for="c-status">Statut</label><Select id="c-status" v-model="form.status" :options="CONTRACT_STATUSES" option-label="label" option-value="value" :disabled="!editable" /></div>
          <div class="form-field"><label for="c-period">Facturation</label><Select id="c-period" v-model="form.period" :options="BILLING_PERIODS" option-label="label" option-value="value" :disabled="!editable" /></div>
          <div class="form-field"><label for="c-start">Début</label><DatePicker v-model="form.start" input-id="c-start" date-format="dd/mm/yy" :disabled="!editable" /></div>
          <div class="form-field"><label for="c-end">Échéance</label><DatePicker v-model="form.end" input-id="c-end" date-format="dd/mm/yy" show-button-bar :disabled="!editable" /></div>
          <div class="form-field"><label for="c-next">Prochaine facture</label><DatePicker v-model="form.next" input-id="c-next" date-format="dd/mm/yy" :disabled="!editable" /></div>
          <div class="form-field"><label for="c-visits">Visites par an</label><InputNumber v-model="form.visits" input-id="c-visits" :min="0" :max="365" :disabled="!editable" /></div>
          <div class="form-field"><label for="c-notice">Préavis (jours)</label><InputNumber v-model="form.notice" input-id="c-notice" :min="0" :max="365" :disabled="!editable" /></div>
          <div class="form-field"><label class="switch"><ToggleSwitch v-model="form.tacit" :disabled="!editable" /> Reconduction tacite</label></div>
        </div>
      </template>
    </Card>

    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="lines">Prestations</Tab>
        <Tab v-if="contract!.invoices" value="invoices">Factures ({{ contract!.invoices.length }})</Tab>
        <Tab v-if="contract!.visits_per_year" value="visits">Visites ({{ contract!.visits?.length ?? 0 }})</Tab>
        <Tab value="terms">Description et conditions</Tab>
        <Tab value="documents">Documents</Tab>
        <Tab value="comments">Commentaires</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="lines">
          <table class="list">
            <thead><tr><th>Forfait / désignation</th><th style="width:110px">Quantité</th><th style="width:90px">Unité</th><th v-if="canPrices" style="width:170px">Prix / période</th><th v-if="canPrices" class="num" style="width:140px">Total</th><th /></tr></thead>
            <tbody>
              <tr v-for="(l, i) in lines" :key="i">
                <td>
                  <Select v-model="l.flat_rate_id" :options="[{ id: null, designation: 'Ligne libre' }, ...rates]" option-label="designation" option-value="id" filter fluid :disabled="!editable" @change="pickRate(i)" />
                  <InputText v-model="l.designation" fluid class="designation" :disabled="!editable" />
                </td>
                <td><InputNumber v-model="l.quantity" :min="0" :max-fraction-digits="2" fluid :disabled="!editable" /></td>
                <td><InputText v-model="l.unit" fluid :disabled="!editable" /></td>
                <td v-if="canPrices"><InputNumber v-model="l.unit_price" :min="0" fluid :disabled="!editable" /></td>
                <td v-if="canPrices" class="num">{{ money((l.quantity || 0) * (l.unit_price || 0)) }}</td>
                <td><Button v-if="editable" icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="lines.splice(i, 1)" /></td>
              </tr>
            </tbody>
            <tfoot v-if="canPrices">
              <tr><td colspan="4" class="num"><strong>Par période</strong></td><td class="num"><strong>{{ money(total) }}</strong></td><td /></tr>
              <tr><td colspan="4" class="num muted">Sur un an</td><td class="num muted">{{ money(yearlyAmount(total, months)) }}</td><td /></tr>
            </tfoot>
          </table>
          <Button v-if="editable" label="Ajouter une prestation" icon="pi pi-plus" text size="small" @click="lines.push({ flat_rate_id: null, designation: '', unit: null, quantity: 1, unit_price: 0 })" />
        </TabPanel>
        <TabPanel v-if="contract!.visits_per_year" value="visits">
          <p class="muted">
            {{ contract!.visits_per_year }} visite(s) par an, réparties à partir du début du contrat. Chaque visite est ajoutée
            au planning un mois avant, sous forme de tâche à affecter.
          </p>
          <table v-if="contract!.visits?.length" class="list">
            <thead><tr><th>Visite</th><th>Prévue le</th><th>Tâche</th><th>État</th></tr></thead>
            <tbody>
              <tr v-for="v in contract!.visits" :key="v.id">
                <td>{{ v.number }}/{{ contract!.visits_per_year }}</td>
                <td>{{ formatDate(v.planned_on) }}</td>
                <td><RouterLink v-if="v.task" :to="{ name: 'task', params: { id: v.task.id } }">{{ v.task.title }}</RouterLink><span v-else class="muted">tâche supprimée</span></td>
                <td>{{ v.task?.status.label ?? '' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted">Aucune visite planifiée pour le moment.</p>
        </TabPanel>
        <TabPanel v-if="contract!.invoices" value="invoices">
          <table v-if="contract!.invoices.length" class="list">
            <thead><tr><th>Facture</th><th>Période</th><th>Statut</th><th v-if="canPrices" class="num">Total</th></tr></thead>
            <tbody>
              <tr v-for="inv in contract!.invoices" :key="inv.id">
                <td><router-link :to="{ name: 'invoice', params: { id: inv.id } }">{{ inv.number ?? 'Brouillon' }}</router-link></td>
                <td>{{ formatDate(inv.period_start) }} → {{ formatDate(inv.period_end) }}</td>
                <td>{{ inv.status.label }}</td>
                <td v-if="canPrices" class="num">{{ inv.total !== undefined ? money(inv.total) : '' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted">Aucune facture. « Facturer la période » crée la facture brouillon de la prochaine période.</p>
        </TabPanel>
        <TabPanel value="terms">
          <div class="form-grid">
            <div class="form-field form-field--full"><label for="c-desc">Description des prestations</label><Textarea id="c-desc" v-model="form.description" rows="4" auto-resize :disabled="!editable" /></div>
            <div class="form-field form-field--full"><label for="c-terms">Conditions particulières</label><Textarea id="c-terms" v-model="form.terms" rows="6" auto-resize :disabled="!editable" /></div>
          </div>
        </TabPanel>
        <TabPanel value="documents"><AttachmentsPanel kind="documents" type="contracts" :id="contract!.id" :can-add="editable" :can-manage="!!contract!.can.delete" /></TabPanel>
        <TabPanel value="comments"><CommentsPanel type="contracts" :id="contract!.id" /></TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.page-header {
  align-items: center;
}

.designation {
  margin-top: 0.25rem;
}

.list td {
  vertical-align: top;
}

.num {
  text-align: right;
}

.grow {
  flex: 1;
}
</style>
