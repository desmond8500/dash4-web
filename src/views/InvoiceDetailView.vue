<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, formatMoney, PAYMENT_METHODS, TAX_MODE_LABELS } from '@dash4/shared'
import type { BankAccount, Invoice, InvoiceLine, PaymentMethod, TaxMode } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import InvoiceEmailDialog from '@/components/invoices/InvoiceEmailDialog.vue'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { formatDateTime } from '@/utils/clientRequests'
import { canReceivePayment, invoiceStatusSeverity } from '@/utils/invoices'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const invoice = ref<Invoice | null>(null)
const loading = ref(true)
const notFound = ref(false)
const busy = ref(false)
const tab = ref('payments')
const banks = ref<BankAccount[]>([])
const emailOpen = ref(false)

const currency = computed(() => settings.currency())
const money = (v: number | undefined) => (v === undefined ? '' : formatMoney(v, currency.value))
const editable = computed(() => !!invoice.value?.can.edit)
const payable = computed(() => !!invoice.value && canReceivePayment(invoice.value))
const taxOptions = (Object.entries(TAX_MODE_LABELS) as Array<[TaxMode, string]>).map(([value, label]) => ({ value, label }))

const header = reactive({
  title: '',
  due: null as Date | null,
  tax_mode: 'none' as TaxMode,
  bank_account_id: null as number | null,
  show_signature: true,
  introduction: '',
  payment_terms: '',
  notes: '',
})

function setInvoice(i: Invoice): void {
  invoice.value = i
  Object.assign(header, {
    title: i.title,
    due: fromApiDate(i.due_at),
    tax_mode: i.tax_mode.value,
    bank_account_id: i.bank_account_id,
    show_signature: i.show_signature,
    introduction: i.introduction ?? '',
    payment_terms: i.payment_terms ?? '',
    notes: i.notes ?? '',
  })
}

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    const i = await api.invoices.get(Number(props.id))
    setInvoice(i)
    tab.value = i.status.value === 'draft' ? 'notes' : 'payments'
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })
void settings.load()
if (auth.can('bank.view')) api.bankAccounts.list().then((b) => (banks.value = b)).catch(() => undefined)

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

/** Envoie un changement et remplace la facture par la réponse (totaux recalculés). */
async function run(action: () => Promise<Invoice>, failure = 'Modification impossible'): Promise<boolean> {
  busy.value = true
  try {
    setInvoice(await action())
    return true
  } catch (e) {
    toast.add({ severity: 'error', summary: failure, detail: errorDetail(e), life: 5000 })
    if (invoice.value) setInvoice(invoice.value)
    return false
  } finally {
    busy.value = false
  }
}

const id = () => invoice.value!.id

function saveHeader(field: keyof typeof header): void {
  if (!invoice.value || (!editable.value && field !== 'notes')) return
  const value = header[field]
  if (field === 'title' && !header.title.trim()) {
    header.title = invoice.value.title
    return
  }
  const payload =
    field === 'due'
      ? { due_at: toApiDate(value as Date | null) }
      : typeof value === 'string'
        ? { [field]: field === 'title' ? value.trim() : value.trim() || null }
        : { [field]: value }
  void run(() => api.invoices.update(id(), payload))
}

// Lignes du brouillon
const newLine = reactive({ designation: '', quantity: 1, unit_price: 0 })
function addLine(): void {
  if (!newLine.designation.trim()) return
  const payload = { designation: newLine.designation.trim(), quantity: newLine.quantity, unit_price: newLine.unit_price }
  void run(() => api.invoices.addLine(id(), payload)).then((ok) => ok && Object.assign(newLine, { designation: '', quantity: 1, unit_price: 0 }))
}
function updateLine(line: InvoiceLine, field: 'designation' | 'quantity' | 'unit_price', value: string | number | null): void {
  if (value === null || value === '' || value === line[field]) return
  void run(() => api.invoices.updateLine(line.id, { [field]: typeof value === 'string' ? value.trim() : value }))
}
const removeLine = (line: InvoiceLine) => run(() => api.invoices.removeLine(line.id))

// Émission
const issueOpen = ref(false)
const issueForm = reactive({ issued: new Date() as Date | null, due: null as Date | null })
function openIssue(): void {
  const today = new Date()
  issueForm.issued = today
  issueForm.due = header.due ?? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)
  issueOpen.value = true
}
async function issue(): Promise<void> {
  const ok = await run(
    () => api.invoices.issue(id(), { issued_at: toApiDate(issueForm.issued) ?? undefined, due_at: toApiDate(issueForm.due) }),
    'Émission impossible',
  )
  if (ok) {
    issueOpen.value = false
    tab.value = 'payments'
    toast.add({ severity: 'success', summary: `Facture ${invoice.value?.number} émise`, life: 4000 })
  }
}

function cancelInvoice(): void {
  confirm.require({
    header: 'Annuler la facture',
    message: `Annuler la facture ${invoice.value?.number} ? Elle reste numérotée, avec la mention « Annulée ».`,
    acceptProps: { label: 'Annuler la facture', severity: 'danger' },
    rejectProps: { label: 'Retour', severity: 'secondary', text: true },
    accept: () => run(() => api.invoices.cancel(id()), 'Annulation impossible'),
  })
}

function remove(): void {
  const i = invoice.value
  if (!i) return
  confirm.require({
    header: 'Supprimer le brouillon',
    message: `Supprimer le brouillon « ${i.title} » ?`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.invoices.remove(i.id)
      void (i.quote_id ? router.push({ name: 'quote', params: { id: i.quote_id } }) : router.push({ name: 'invoices' }))
    },
  })
}

async function openPdf(): Promise<void> {
  if (!invoice.value) return
  busy.value = true
  try {
    const url = URL.createObjectURL(await api.invoices.pdf(invoice.value.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    busy.value = false
  }
}

function onSent(i: Invoice): void {
  setInvoice(i)
  toast.add({ severity: 'success', summary: 'Facture envoyée', detail: i.emails?.[0]?.to.join(', '), life: 4000 })
}

// Paiements
const payment = reactive({ amount: 0, date: new Date() as Date | null, method: 'bank_transfer' as PaymentMethod, reference: '' })
watch(
  () => invoice.value?.remaining_amount,
  (remaining) => (payment.amount = remaining ?? 0),
  { immediate: true },
)
function addPayment(): void {
  if (!payment.amount) return
  void run(
    () =>
      api.invoices.addPayment(id(), {
        amount: payment.amount,
        paid_at: toApiDate(payment.date) ?? undefined,
        method: payment.method,
        reference: payment.reference.trim() || null,
      }),
    'Paiement refusé',
  ).then((ok) => {
    if (ok) {
      payment.reference = ''
      toast.add({ severity: 'success', summary: 'Paiement enregistré', detail: invoice.value?.status.label, life: 3000 })
    }
  })
}
function removePayment(paymentId: number): void {
  confirm.require({
    header: 'Retirer le paiement',
    message: 'Retirer ce paiement ? Le reste à payer sera recalculé.',
    acceptProps: { label: 'Retirer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => run(() => api.invoices.removePayment(paymentId)),
  })
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !invoice" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Cette facture n'existe pas ou a été supprimée.</p>
      <RouterLink :to="{ name: 'invoices' }">Retour aux factures</RouterLink>
    </div>

    <template v-else-if="invoice">
      <RouterLink :to="{ name: 'invoices' }" class="back"><i class="pi pi-arrow-left" /> Factures</RouterLink>

      <div class="page-header">
        <div class="title">
          <h1>{{ invoice.number ?? 'Brouillon de facture' }}</h1>
          <Tag :value="invoice.status.label" :severity="invoiceStatusSeverity(invoice.status.value)" />
          <Tag v-if="invoice.is_overdue" value="En retard" severity="danger" icon="pi pi-clock" />
          <span class="muted">
            <RouterLink :to="{ name: 'client', params: { id: invoice.client_id } }">{{ invoice.client?.name }}</RouterLink>
            <template v-if="invoice.quote">
              · <RouterLink :to="{ name: 'quote', params: { id: invoice.quote.id } }">Devis {{ invoice.quote.number }}</RouterLink>
            </template>
            <template v-if="invoice.project">
              · <RouterLink :to="{ name: 'project', params: { id: invoice.project.id } }">{{ invoice.project.name }}</RouterLink>
            </template>
          </span>
        </div>
        <div class="actions">
          <Button v-if="editable && invoice.can.issue" label="Émettre" icon="pi pi-check-circle" :disabled="busy || !invoice.lines?.length" @click="openIssue" />
          <Button v-if="invoice.number && invoice.can.update && invoice.status.value !== 'cancelled'" label="Envoyer" icon="pi pi-send" @click="emailOpen = true" />
          <Button label="PDF" icon="pi pi-file-pdf" severity="secondary" :loading="busy" @click="openPdf" />
          <Button
            v-if="invoice.can.issue && ['issued', 'partially_paid'].includes(invoice.status.value) && !invoice.payments?.length"
            label="Annuler"
            icon="pi pi-ban"
            severity="secondary"
            outlined
            @click="cancelInvoice"
          />
          <Button v-if="invoice.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" @click="remove" />
        </div>
      </div>

      <Message v-if="editable" severity="info" :closable="false">
        Brouillon sans numéro : relisez les lignes et les montants, puis « Émettre ». Le numéro est attribué à l'émission
        et la facture ne se modifie plus ensuite.
      </Message>
      <Message v-else-if="invoice.status.value === 'draft' && invoice.can.update" severity="info" :closable="false">
        Brouillon : l'émission est réservée aux personnes qui ont le droit d'émettre les factures.
      </Message>

      <div class="layout">
        <div class="main">
          <Card>
            <template #content>
              <div class="form-grid">
                <div class="form-field form-field--full">
                  <label for="i-title">Titre</label>
                  <InputText id="i-title" v-model="header.title" :disabled="!editable" @change="saveHeader('title')" />
                </div>
                <div class="form-field form-field--full">
                  <label for="i-intro">Introduction</label>
                  <Textarea id="i-intro" v-model="header.introduction" rows="2" auto-resize :disabled="!editable" @change="saveHeader('introduction')" />
                </div>
              </div>

              <table class="list lines">
                <thead>
                  <tr><th>Désignation</th><th class="qty">Quantité</th><th class="num">Prix unitaire</th><th class="num">Montant</th><th v-if="editable" /></tr>
                </thead>
                <tbody>
                  <tr v-for="line in invoice.lines" :key="line.id">
                    <template v-if="editable">
                      <td><InputText :model-value="line.designation" fluid @change="updateLine(line, 'designation', ($event.target as HTMLInputElement).value)" /></td>
                      <td class="qty"><InputNumber :model-value="line.quantity" :min="0" :max-fraction-digits="2" fluid @update:model-value="(v) => updateLine(line, 'quantity', v)" /></td>
                      <td class="num"><InputNumber :model-value="line.unit_price" fluid @update:model-value="(v) => updateLine(line, 'unit_price', v)" /></td>
                    </template>
                    <template v-else>
                      <td><div class="pre">{{ line.designation }}</div><div v-if="line.reference" class="muted small pre">{{ line.reference }}</div></td>
                      <td class="qty">{{ line.quantity.toLocaleString('fr-FR') }} {{ line.unit }}</td>
                      <td class="num">{{ money(line.unit_price) }}</td>
                    </template>
                    <td class="num" :class="{ negative: line.line_total < 0 }">{{ money(line.line_total) }}</td>
                    <td v-if="editable"><Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer la ligne" @click="removeLine(line)" /></td>
                  </tr>
                  <tr v-if="!invoice.lines?.length"><td colspan="5" class="muted">Aucune ligne.</td></tr>
                </tbody>
              </table>
              <form v-if="editable" class="new-line" @submit.prevent="addLine">
                <InputText v-model="newLine.designation" placeholder="Nouvelle ligne : désignation" class="grow" />
                <InputNumber v-model="newLine.quantity" :min="0" :max-fraction-digits="2" placeholder="Qté" class="qty-input" />
                <InputNumber v-model="newLine.unit_price" placeholder="Prix unitaire" class="price-input" />
                <Button type="submit" icon="pi pi-plus" label="Ajouter" size="small" :disabled="!newLine.designation.trim()" />
              </form>
              <small v-if="editable" class="muted">Prix négatif pour une remise ou une déduction.</small>
            </template>
          </Card>

          <Tabs v-model:value="tab">
            <TabList>
              <Tab value="payments">Paiements <span v-if="invoice.payments?.length" class="count">{{ invoice.payments.length }}</span></Tab>
              <Tab value="notes">Notes</Tab>
              <Tab value="documents">Documents</Tab>
              <Tab value="links">Liens</Tab>
              <Tab value="emails">Envois <span v-if="invoice.emails?.length" class="count">{{ invoice.emails.length }}</span></Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="payments">
                <div class="panel">
                  <table v-if="invoice.payments?.length" class="list">
                    <thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="num">Montant</th><th>Par</th><th v-if="invoice.can.update" /></tr></thead>
                    <tbody>
                      <tr v-for="p in invoice.payments" :key="p.id">
                        <td>{{ formatDate(p.paid_at) }}</td>
                        <td>{{ p.method.label }}</td>
                        <td>{{ p.reference ?? '' }}<div v-if="p.note" class="muted small">{{ p.note }}</div></td>
                        <td class="num">{{ money(p.amount) }}</td>
                        <td>{{ p.creator?.full_name ?? '—' }}</td>
                        <td v-if="invoice.can.update">
                          <Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Retirer" @click="removePayment(p.id)" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p v-else-if="invoice.status.value === 'draft'" class="muted">Les paiements s'enregistrent une fois la facture émise.</p>
                  <p v-else class="muted">Aucun paiement reçu.</p>

                  <form v-if="payable" class="add" @submit.prevent="addPayment">
                    <InputNumber v-model="payment.amount" :min="1" :max="invoice.remaining_amount" :suffix="currency === 'XOF' ? ' F CFA' : ` ${currency}`" />
                    <DatePicker v-model="payment.date" date-format="dd/mm/yy" />
                    <Select v-model="payment.method" :options="PAYMENT_METHODS" option-label="label" option-value="value" />
                    <InputText v-model="payment.reference" placeholder="Référence (n° de chèque, de transaction…)" />
                    <Button type="submit" label="Enregistrer le paiement" icon="pi pi-plus" size="small" :disabled="busy || !payment.amount" />
                  </form>
                </div>
              </TabPanel>
              <TabPanel value="emails">
                <table v-if="invoice.emails?.length" class="list">
                  <thead><tr><th>Date</th><th>Destinataires</th><th>Objet</th><th>Par</th></tr></thead>
                  <tbody>
                    <tr v-for="m in invoice.emails" :key="m.id">
                      <td>{{ formatDateTime(m.sent_at) }}</td>
                      <td>{{ m.to.join(', ') }}<div v-if="m.cc.length" class="muted small">Copie : {{ m.cc.join(', ') }}</div></td>
                      <td>{{ m.subject }}</td>
                      <td>{{ m.sender?.full_name ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="muted">Cette facture n'a pas encore été envoyée par e-mail.</p>
              </TabPanel>
              <TabPanel v-for="kind in (['notes', 'documents', 'links'] as const)" :key="kind" :value="kind">
                <AttachmentsPanel :kind="kind" type="invoices" :id="invoice.id" :can-add="invoice.can.update" :can-manage="invoice.can.update" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        <aside class="side">
          <Card>
            <template #title>Totaux</template>
            <template #content>
              <table class="totals">
                <tr><td>Total hors taxes</td><td>{{ money(invoice.subtotal) }}</td></tr>
                <tr v-if="invoice.tax_mode.value === 'vat'"><td>TVA ({{ invoice.vat_rate }} %)</td><td>{{ money(invoice.tax_amount) }}</td></tr>
                <tr v-if="invoice.tax_mode.value === 'brs'"><td>Retenue BRS ({{ invoice.brs_rate }} %)</td><td>− {{ money(invoice.tax_amount) }}</td></tr>
                <tr class="grand">
                  <td>{{ invoice.tax_mode.value === 'vat' ? 'Total TTC' : invoice.tax_mode.value === 'brs' ? 'Net à payer' : 'Total' }}</td>
                  <td>{{ money(invoice.total) }}</td>
                </tr>
                <template v-if="invoice.status.value !== 'draft' && invoice.status.value !== 'cancelled'">
                  <tr><td>Déjà réglé</td><td>{{ money(invoice.paid_amount) }}</td></tr>
                  <tr class="remaining"><td>Reste à payer</td><td>{{ money(invoice.remaining_amount) }}</td></tr>
                </template>
              </table>
              <p v-if="invoice.issued_at" class="muted small dates">
                Émise le {{ formatDate(invoice.issued_at) }}<template v-if="invoice.issuer"> par {{ invoice.issuer.full_name }}</template>
                <template v-if="invoice.due_at"> · échéance le {{ formatDate(invoice.due_at) }}</template>
                <template v-if="invoice.paid_at"> · payée le {{ formatDate(invoice.paid_at) }}</template>
              </p>
            </template>
          </Card>

          <Card>
            <template #title>Réglages</template>
            <template #content>
              <div class="settings">
                <div class="form-field">
                  <label for="i-tax">Taxe</label>
                  <Select id="i-tax" v-model="header.tax_mode" :options="taxOptions" option-label="label" option-value="value" :disabled="!editable" @change="saveHeader('tax_mode')" />
                </div>
                <div class="form-field">
                  <label for="i-due">Échéance</label>
                  <DatePicker id="i-due" v-model="header.due" date-format="dd/mm/yy" show-button-bar :disabled="!editable" placeholder="30 jours après l'émission" @update:model-value="saveHeader('due')" />
                </div>
                <div v-if="banks.length" class="form-field">
                  <label for="i-bank">Compte bancaire sur le PDF</label>
                  <Select
                    id="i-bank"
                    v-model="header.bank_account_id"
                    :options="[{ id: null, label: 'Aucun' }, ...banks.map((b) => ({ id: b.id, label: b.label ? `${b.bank_name} — ${b.label}` : b.bank_name }))]"
                    option-label="label"
                    option-value="id"
                    :disabled="!editable"
                    @change="saveHeader('bank_account_id')"
                  />
                </div>
                <label class="switch">
                  <ToggleSwitch v-model="header.show_signature" :disabled="!editable" @update:model-value="saveHeader('show_signature')" />
                  Signature et cachet
                </label>
                <div class="form-field">
                  <label for="i-terms">Modalités de paiement</label>
                  <Textarea id="i-terms" v-model="header.payment_terms" rows="3" auto-resize :disabled="!editable" @change="saveHeader('payment_terms')" />
                </div>
                <div class="form-field">
                  <label for="i-notes">Notes internes</label>
                  <Textarea id="i-notes" v-model="header.notes" rows="3" auto-resize :disabled="!invoice.can.update" @change="saveHeader('notes')" />
                  <small class="muted">Jamais imprimées ; modifiables après l'émission.</small>
                </div>
              </div>
            </template>
          </Card>
        </aside>
      </div>

      <Dialog v-model:visible="issueOpen" header="Émettre la facture" modal :style="{ width: '440px' }">
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label for="iss-date">Date de la facture</label>
            <DatePicker id="iss-date" v-model="issueForm.issued" date-format="dd/mm/yy" />
          </div>
          <div class="form-field form-field--full">
            <label for="iss-due">À régler avant le</label>
            <DatePicker id="iss-due" v-model="issueForm.due" date-format="dd/mm/yy" show-button-bar />
          </div>
          <p class="form-field--full muted small">
            Total : <strong>{{ money(invoice.total) }}</strong>. Le prochain numéro de facture est attribué et la facture ne se modifie plus.
          </p>
        </div>
        <template #footer>
          <Button label="Annuler" severity="secondary" text @click="issueOpen = false" />
          <Button label="Émettre" icon="pi pi-check-circle" :loading="busy" @click="issue" />
        </template>
      </Dialog>

      <InvoiceEmailDialog v-if="invoice.number" v-model:visible="emailOpen" :invoice="invoice" @sent="onSent" />
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

.title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.title h1 {
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lines {
  margin-top: 1rem;
}

.lines .qty {
  width: 8rem;
}

.lines td.num,
.lines th.num {
  width: 10rem;
}

.new-line {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.new-line .grow {
  flex: 1;
  min-width: 14rem;
}

.qty-input :deep(input) {
  width: 5rem;
}

.price-input :deep(input) {
  width: 9rem;
}

.pre {
  white-space: pre-wrap;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}

.totals {
  width: 100%;
  border-collapse: collapse;
}

.totals td {
  padding: 0.3rem 0;
}

.totals td:last-child {
  text-align: right;
  white-space: nowrap;
}

.totals .grand td {
  font-size: 1.1rem;
  font-weight: 700;
  border-top: 2px solid var(--p-content-border-color);
  padding-top: 0.5rem;
}

.totals .remaining td {
  font-weight: 700;
}

.negative {
  color: var(--p-red-500);
}

.settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.small {
  font-size: 0.8rem;
  margin: 0;
}

.dates {
  margin-top: 0.75rem;
}
</style>
