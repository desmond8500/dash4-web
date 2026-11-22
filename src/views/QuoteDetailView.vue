<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, EDITABLE_QUOTE_STATUSES, formatMoney, TAX_MODE_LABELS } from '@dash4/shared'
import type { BankAccount, Quote, QuoteLinePayload, QuoteSection, QuoteSystem, TaxMode } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import QuoteSectionEditor from '@/components/quotes/QuoteSectionEditor.vue'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import CommentsPanel from '@/components/CommentsPanel.vue'
import QuoteDepositsPanel from '@/components/quotes/QuoteDepositsPanel.vue'
import QuoteExpensesPanel from '@/components/quotes/QuoteExpensesPanel.vue'
import QuoteDeliveryNotesPanel from '@/components/quotes/QuoteDeliveryNotesPanel.vue'
import QuoteProposalPanel from '@/components/quotes/QuoteProposalPanel.vue'
import QuoteEmailDialog from '@/components/quotes/QuoteEmailDialog.vue'
import QuoteTemplatePicker from '@/components/quotes/QuoteTemplatePicker.vue'
import InvoiceCreateDialog from '@/components/invoices/InvoiceCreateDialog.vue'
import { invoiceStatusSeverity } from '@/utils/invoices'
import Dialog from 'primevue/dialog'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { formatDateTime } from '@/utils/clientRequests'
import { quoteStatusSeverity, statusActions, type StatusAction } from '@/utils/quotes'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const quote = ref<Quote | null>(null)
const commentsCount = ref(0)
const loading = ref(true)
const notFound = ref(false)
const busy = ref(false)
const tab = ref(useRoute().query.onglet === 'commentaires' ? 'comments' : 'notes')
const signedInput = ref<HTMLInputElement | null>(null)
const banks = ref<BankAccount[]>([])

const editable = computed(() => !!quote.value?.can.update && EDITABLE_QUOTE_STATUSES.includes(quote.value.status.value))
const showPrices = computed(() => auth.can('prices.view'))
const currency = computed(() => settings.currency())
const money = (v: number | undefined) => (v === undefined ? '' : formatMoney(v, currency.value))
const actions = computed(() => (quote.value ? statusActions(quote.value) : []))
const sections = computed<QuoteSection[]>(() => quote.value?.sections ?? [])

// En-tête modifiable
const header = reactive({
  title: '',
  issued: null as Date | null,
  valid: null as Date | null,
  tax_mode: 'vat' as TaxMode,
  discount_rate: 0,
  bank_account_id: null as number | null,
  show_signature: true,
  introduction: '',
  payment_terms: '',
  notes: '',
})
const taxOptions = (Object.entries(TAX_MODE_LABELS) as Array<[TaxMode, string]>).map(([value, label]) => ({ value, label }))

function fillHeader(q: Quote): void {
  Object.assign(header, {
    title: q.title,
    issued: fromApiDate(q.issued_at),
    valid: fromApiDate(q.valid_until),
    tax_mode: q.tax_mode.value,
    discount_rate: q.discount_rate,
    bank_account_id: q.bank_account_id,
    show_signature: q.show_signature,
    introduction: q.introduction ?? '',
    payment_terms: q.payment_terms ?? '',
    notes: q.notes ?? '',
  })
}

function setQuote(q: Quote): void {
  quote.value = q
  fillHeader(q)
}

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    setQuote(await api.quotes.get(Number(props.id)))
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

/** Envoie un changement et remplace le devis par la réponse (totaux recalculés). */
// Lignes : formulaires ouverts ou lecture (choix gardé dans ce navigateur)
const FORMS_KEY = 'dash4.quote.lineForms'
const linesForms = ref((() => {
  try {
    return localStorage.getItem(FORMS_KEY) === '1'
  } catch {
    return false
  }
})())
watch(linesForms, (v) => {
  try {
    localStorage.setItem(FORMS_KEY, v ? '1' : '0')
  } catch {
    // Stockage indisponible : le choix vaut pour cette page
  }
})

// Liaison des lignes aux articles du stock
const canLinkArticles = computed(() => !!quote.value?.can.update && auth.can('stock.view'))
const linking = ref(false)
async function linkAll(): Promise<void> {
  if (!quote.value) return
  linking.value = true
  try {
    const r = await api.quotes.linkArticles(quote.value.id)
    setQuote(r.quote)
    toast.add({ severity: r.linked ? 'success' : 'info', summary: 'Articles du stock', detail: r.message, life: 4000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Liaison impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    linking.value = false
  }
}

async function run(action: () => Promise<Quote>, failure = 'Modification impossible'): Promise<void> {
  busy.value = true
  try {
    setQuote(await action())
  } catch (e) {
    const detail = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
    toast.add({ severity: 'error', summary: failure, detail, life: 5000 })
    if (quote.value) fillHeader(quote.value)
  } finally {
    busy.value = false
  }
}

const id = () => quote.value!.id

function saveHeader(field: keyof typeof header): void {
  if (!quote.value || !editable.value) return
  const value = header[field]
  const payload: Record<string, unknown> =
    field === 'issued'
      ? { issued_at: toApiDate(value as Date | null) }
      : field === 'valid'
        ? { valid_until: toApiDate(value as Date | null) }
        : typeof value === 'string'
          ? { [field]: field === 'title' ? value.trim() : value.trim() || null }
          : { [field]: value }
  if (field === 'title' && !header.title.trim()) {
    header.title = quote.value.title
    return
  }
  void run(() => api.quotes.update(id(), payload))
}

function setStatus(action: StatusAction): void {
  const apply = () => run(() => api.quotes.setStatus(id(), action.status), 'Changement de statut impossible')
  if (action.status === 'accepted' || action.status === 'refused' || action.status === 'cancelled') {
    confirm.require({
      header: action.label,
      message:
        action.status === 'accepted'
          ? 'Marquer ce devis comme accepté par le client ? Il ne sera plus modifiable (on pourra le dupliquer).'
          : `Confirmer : ${action.label.toLowerCase()} ?`,
      acceptProps: { label: 'Confirmer', severity: action.severity === 'danger' ? 'danger' : undefined },
      rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
      accept: apply,
    })
  } else {
    void apply()
  }
}

async function openPdf(): Promise<void> {
  if (!quote.value) return
  busy.value = true
  try {
    const url = URL.createObjectURL(await api.quotes.pdf(quote.value.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    busy.value = false
  }
}

async function duplicate(): Promise<void> {
  if (!quote.value) return
  try {
    const copy = await api.quotes.duplicate(quote.value.id)
    toast.add({ severity: 'success', summary: `Devis dupliqué : ${copy.number}`, life: 3000 })
    void router.push({ name: 'quote', params: { id: copy.id } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Duplication impossible', detail: (e as Error).message, life: 5000 })
  }
}

function onSignedCopy(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  void run(() => api.quotes.uploadSignedCopy(id(), file, file.name), 'Envoi de la copie impossible').then(() => {
    toast.add({ severity: 'success', summary: 'Copie signée enregistrée', detail: 'Le devis est accepté.', life: 3000 })
    tab.value = 'documents'
  })
}

function remove(): void {
  const q = quote.value
  if (!q) return
  confirm.require({
    header: 'Supprimer le devis',
    message: `Mettre le devis ${q.number} à la corbeille ?`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.quotes.remove(q.id)
      void router.push({ name: 'quotes' })
    },
  })
}

// Factures du devis accepté
const invoiceOpen = ref(false)
const canInvoice = computed(() => quote.value?.status.value === 'accepted' && auth.can('invoices.create'))

// Étape 2 : e-mail, modèles, proposition technique
const emailOpen = ref(false)
const pickerOpen = ref(false)
const canManageTemplates = computed(() => auth.can('quotes.update') && auth.can('costs.view'))
const templateDialog = ref(false)
const templateSection = ref<QuoteSection | null>(null)
const templateName = ref('')
const templateSystem = ref<number | null>(null)
const systems = ref<QuoteSystem[]>([])

function onSent(q: Quote): void {
  setQuote(q)
  toast.add({ severity: 'success', summary: 'Devis envoyé', detail: q.emails?.[0]?.to.join(', '), life: 4000 })
}

function insertTemplate(templateId: number, sectionId: number | undefined): void {
  void run(() => api.quotes.insertTemplate(id(), templateId, sectionId), 'Insertion impossible')
}

async function openSaveTemplate(section: QuoteSection): Promise<void> {
  templateSection.value = section
  templateName.value = section.title
  templateSystem.value = null
  templateDialog.value = true
  systems.value = (await api.quoteTemplates.catalog()).systems
}

async function saveTemplate(): Promise<void> {
  if (!templateSection.value || !templateName.value.trim()) return
  try {
    await api.quoteTemplates.fromSection(templateSection.value.id, { name: templateName.value.trim(), quote_system_id: templateSystem.value })
    templateDialog.value = false
    toast.add({ severity: 'success', summary: 'Modèle enregistré', detail: templateName.value, life: 3000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: (e as Error).message, life: 5000 })
  }
}

async function openProposalPdf(): Promise<void> {
  if (!quote.value) return
  busy.value = true
  try {
    const url = URL.createObjectURL(await api.quotes.proposalPdf(quote.value.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    busy.value = false
  }
}

// Sections et lignes
const newSection = ref('')
function addSection(): void {
  const title = newSection.value.trim()
  if (!title) return
  newSection.value = ''
  void run(() => api.quotes.addSection(id(), { title }))
}
function moveSection(index: number, direction: -1 | 1): void {
  const ids = sections.value.map((s) => s.id)
  const target = index + direction
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  void run(() => api.quotes.orderSections(id(), ids))
}
function removeSection(section: QuoteSection): void {
  confirm.require({
    header: 'Supprimer la section',
    message: `Supprimer « ${section.title} » et ses ${section.lines.length} ligne(s) ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => run(() => api.quotes.removeSection(section.id)),
  })
}
const addLine = (sectionId: number, payload: QuoteLinePayload) => run(() => api.quotes.addLine(sectionId, payload))
const updateLine = (lineId: number, payload: Partial<QuoteLinePayload>) => run(() => api.quotes.updateLine(lineId, payload))
const removeLine = (lineId: number) => run(() => api.quotes.removeLine(lineId))
const orderLines = (sectionId: number, ids: number[]) => run(() => api.quotes.orderLines(sectionId, ids))
const updateSection = (sectionId: number, payload: { title?: string; is_visible?: boolean }) =>
  run(() => api.quotes.updateSection(sectionId, payload))
</script>

<template>
  <div class="page">
    <div v-if="loading && !quote" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Ce devis n'existe pas, a été supprimé, ou ne fait pas partie de vos devis.</p>
      <RouterLink :to="{ name: 'quotes' }">Retour aux devis</RouterLink>
    </div>

    <template v-else-if="quote">
      <RouterLink :to="{ name: 'quotes' }" class="back"><i class="pi pi-arrow-left" /> Devis</RouterLink>

      <div class="page-header">
        <div class="title">
          <h1>{{ quote.number }}</h1>
          <Tag :value="quote.status.label" :severity="quoteStatusSeverity(quote.status.value)" />
          <Tag v-if="quote.signed_at" value="Copie signée" severity="success" icon="pi pi-verified" />
          <span class="muted">
            <RouterLink :to="{ name: 'client', params: { id: quote.client_id } }">{{ quote.client?.name }}</RouterLink>
            <template v-if="quote.project">
              ·
              <RouterLink :to="{ name: 'project', params: { id: quote.project.id } }">{{ quote.project.name }}</RouterLink>
            </template>
          </span>
        </div>
        <div class="actions">
          <Button v-if="canInvoice" label="Facturer" icon="pi pi-receipt" severity="success" @click="invoiceOpen = true" />
          <Button v-if="quote.can.export && quote.can.update" label="Envoyer" icon="pi pi-send" @click="emailOpen = true" />
          <Button v-if="quote.can.export" label="PDF" icon="pi pi-file-pdf" severity="secondary" :loading="busy" @click="openPdf" />
          <Button v-if="auth.can('quotes.create')" label="Dupliquer" icon="pi pi-copy" severity="secondary" outlined @click="duplicate" />
          <Button v-if="quote.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" @click="remove" />
        </div>
      </div>

      <div v-if="actions.length || quote.can.validate" class="status-bar">
        <Button
          v-for="a in actions"
          :key="a.status"
          :label="a.label"
          :icon="a.icon"
          :severity="a.severity"
          size="small"
          :outlined="a.severity === 'secondary'"
          :disabled="busy"
          @click="setStatus(a)"
        />
        <template v-if="quote.can.validate && !quote.signed_at && quote.status.value !== 'cancelled'">
          <Button label="Joindre la copie signée" icon="pi pi-upload" size="small" text @click="signedInput?.click()" />
          <input ref="signedInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" hidden @change="onSignedCopy" />
        </template>
      </div>

      <Message v-if="!editable && quote.can.update" severity="info" :closable="false">
        Ce devis est « {{ quote.status.label }} » : il ne se modifie plus. Dupliquez-le pour en faire une nouvelle version.
      </Message>

      <div class="layout">
        <div class="main">
          <Card>
            <template #content>
              <div class="form-grid">
                <div class="form-field form-field--full">
                  <label for="q-title">Objet</label>
                  <InputText id="q-title" v-model="header.title" :disabled="!editable" @change="saveHeader('title')" />
                </div>
                <div class="form-field">
                  <label for="q-issued">Date du devis</label>
                  <DatePicker v-model="header.issued" input-id="q-issued" date-format="dd/mm/yy" :disabled="!editable" @update:model-value="saveHeader('issued')" />
                </div>
                <div class="form-field">
                  <label for="q-valid">Valable jusqu'au</label>
                  <DatePicker v-model="header.valid" input-id="q-valid" date-format="dd/mm/yy" show-button-bar :disabled="!editable" @update:model-value="saveHeader('valid')" />
                </div>
                <div class="form-field form-field--full">
                  <label for="q-intro">Introduction (en tête du devis)</label>
                  <MarkdownEditor id="q-intro" v-model="header.introduction" rows="2" auto-resize :disabled="!editable" @change="saveHeader('introduction')" />
                </div>
              </div>
            </template>
          </Card>

          <div v-if="sections.length && (editable || canLinkArticles)" class="lines-toolbar">
            <label v-if="editable" class="lines-toggle">
              <ToggleSwitch v-model="linesForms" input-id="q-forms" />
              <span>Formulaires des lignes</span>
            </label>
            <span class="grow" />
            <Button
              v-if="canLinkArticles"
              label="Lier aux articles du stock"
              icon="pi pi-link"
              text
              size="small"
              title="Lie les lignes sans article à l'article de même référence ou de même désignation"
              :loading="linking"
              @click="linkAll"
            />
          </div>

          <QuoteSectionEditor
            v-for="(section, index) in sections"
            :key="section.id"
            :section="section"
            :sections="sections"
            :editable="editable"
            :edit-prices="editable && quote.can.edit_prices"
            :show-prices="showPrices"
            :currency="currency"
            :first="index === 0"
            :last="index === sections.length - 1"
            :can-edit-proposal="quote.can.update"
            :can-save-template="canManageTemplates"
            :forms="linesForms"
            :can-link="canLinkArticles"
            @link-article="(lineId, articleId) => run(() => api.quotes.linkArticle(lineId, articleId), 'Liaison impossible')"
            @save-proposal="(text) => run(() => api.quotes.setSectionProposal(section.id, text))"
            @save-as-template="openSaveTemplate(section)"
            @update-section="(p) => updateSection(section.id, p)"
            @remove-section="removeSection(section)"
            @move-section="(d) => moveSection(index, d)"
            @add-line="(p) => addLine(section.id, p)"
            @update-line="updateLine"
            @remove-line="removeLine"
            @order-lines="(ids) => orderLines(section.id, ids)"
          />

          <form v-if="editable" class="new-section" @submit.prevent="addSection">
            <InputText v-model="newSection" placeholder="Nouvelle section (ex. : Câblage, Main-d'œuvre…)" />
            <Button type="submit" label="Ajouter la section" icon="pi pi-plus" severity="secondary" :disabled="!newSection.trim()" />
            <Button label="Insérer un modèle" icon="pi pi-clone" severity="secondary" outlined @click="pickerOpen = true" />
          </form>

          <Card>
            <template #content>
              <div class="form-grid">
                <div class="form-field form-field--full">
                  <label for="q-terms">Modalités de paiement</label>
                  <MarkdownEditor id="q-terms" v-model="header.payment_terms" rows="2" auto-resize placeholder="Ex. : 50 % à la commande, solde à la livraison" :disabled="!editable" @change="saveHeader('payment_terms')" />
                </div>
                <div class="form-field form-field--full">
                  <label for="q-notes">Notes internes (non imprimées)</label>
                  <MarkdownEditor id="q-notes" v-model="header.notes" rows="2" auto-resize :disabled="!quote.can.update" @change="saveHeader('notes')" />
                </div>
              </div>
            </template>
          </Card>

          <Tabs v-model:value="tab" scrollable>
            <TabList>
              <Tab value="comments">Commentaires <span v-if="commentsCount" class="count">{{ commentsCount }}</span></Tab>
              <Tab value="notes">Notes</Tab>
              <Tab value="documents">Documents</Tab>
              <Tab value="links">Liens</Tab>
              <Tab v-if="showPrices" value="deposits">Acomptes <span v-if="quote.deposits?.length" class="count">{{ quote.deposits.length }}</span></Tab>
              <Tab v-if="quote.expenses !== undefined" value="expenses">Dépenses <span v-if="quote.expenses.length" class="count">{{ quote.expenses.length }}</span></Tab>
              <Tab value="delivery">Bordereaux <span v-if="quote.delivery_notes?.length" class="count">{{ quote.delivery_notes.length }}</span></Tab>
              <Tab value="proposal">Proposition technique</Tab>
              <Tab v-if="quote.invoices !== undefined" value="invoices">Factures <span v-if="quote.invoices.length" class="count">{{ quote.invoices.length }}</span></Tab>
              <Tab value="emails">Envois <span v-if="quote.emails?.length" class="count">{{ quote.emails.length }}</span></Tab>
            </TabList>
            <TabPanels>
              <TabPanel v-if="showPrices" value="deposits">
                <QuoteDepositsPanel :quote="quote" :currency="currency" :can-edit="quote.can.update" @run="(a) => run(a)" />
              </TabPanel>
              <TabPanel v-if="quote.expenses !== undefined" value="expenses">
                <QuoteExpensesPanel :quote="quote" :currency="currency" :can-edit="quote.can.update" @run="(a) => run(a)" />
              </TabPanel>
              <TabPanel value="delivery">
                <QuoteDeliveryNotesPanel :quote="quote" :can-edit="quote.can.update" @run="(a) => run(a)" />
              </TabPanel>
              <TabPanel value="proposal">
                <QuoteProposalPanel :quote="quote" :can-edit="quote.can.update" :can-see-prices="quote.can.export" :busy="busy" @run="(a) => run(a)" @pdf="openProposalPdf" />
              </TabPanel>
              <TabPanel v-if="quote.invoices !== undefined" value="invoices">
                <div class="panel">
                  <table v-if="quote.invoices.length" class="list">
                    <thead><tr><th>Numéro</th><th>Titre</th><th>Statut</th><th class="num">Hors taxes</th><th class="num">Total</th><th class="num">Réglé</th></tr></thead>
                    <tbody>
                      <tr v-for="i in quote.invoices" :key="i.id" class="clickable" @click="router.push({ name: 'invoice', params: { id: i.id } })">
                        <td><strong v-if="i.number">{{ i.number }}</strong><span v-else class="muted">Brouillon</span></td>
                        <td>{{ i.title }}</td>
                        <td><Tag :value="i.status.label" :severity="invoiceStatusSeverity(i.status.value)" /></td>
                        <td class="num">{{ money(i.subtotal) }}</td>
                        <td class="num">{{ money(i.total) }}</td>
                        <td class="num">{{ money(i.paid_amount) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr><td colspan="3">Facturé (hors taxes, hors annulées)</td><td class="num">{{ money(quote.invoiced_net) }}</td><td colspan="2" /></tr>
                      <tr class="strong"><td colspan="3">Reste à facturer</td><td class="num">{{ money(quote.remaining_to_invoice) }}</td><td colspan="2" /></tr>
                    </tfoot>
                  </table>
                  <p v-else class="muted">Aucune facture pour ce devis.</p>
                  <Button v-if="canInvoice" label="Nouvelle facture" icon="pi pi-plus" size="small" @click="invoiceOpen = true" />
                  <p v-else-if="quote.status.value !== 'accepted'" class="muted small">Un devis se facture une fois accepté.</p>
                </div>
              </TabPanel>
              <TabPanel value="emails">
                <table v-if="quote.emails?.length" class="list">
                  <thead><tr><th>Date</th><th>Destinataires</th><th>Objet</th><th>Pièces jointes</th><th>Par</th></tr></thead>
                  <tbody>
                    <tr v-for="m in quote.emails" :key="m.id">
                      <td>{{ formatDateTime(m.sent_at) }}</td>
                      <td>{{ m.to.join(', ') }}<div v-if="m.cc.length" class="muted small">Copie : {{ m.cc.join(', ') }}</div></td>
                      <td>{{ m.subject }}</td>
                      <td class="small">{{ m.attachments.join(', ') }}</td>
                      <td>{{ m.sender?.full_name ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="muted">Ce devis n'a pas encore été envoyé par e-mail.</p>
              </TabPanel>
              <TabPanel value="comments"><CommentsPanel type="quotes" :id="quote.id" @changed="commentsCount = $event" /></TabPanel>
              <TabPanel v-for="kind in (['notes', 'documents', 'links'] as const)" :key="kind" :value="kind">
                <AttachmentsPanel :kind="kind" type="quotes" :id="quote.id" :can-add="quote.can.update" :can-manage="quote.can.delete" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        <aside class="side">
          <Card v-if="showPrices">
            <template #title>Totaux</template>
            <template #content>
              <table class="totals">
                <tr><td>Total hors taxes</td><td>{{ money(quote.subtotal) }}</td></tr>
                <tr v-if="quote.discount_amount"><td>Remise ({{ quote.discount_rate }} %)</td><td>− {{ money(quote.discount_amount) }}</td></tr>
                <tr v-if="quote.discount_amount"><td>Net hors taxes</td><td>{{ money(quote.net_amount) }}</td></tr>
                <tr v-if="quote.tax_mode.value === 'vat'"><td>TVA ({{ quote.vat_rate }} %)</td><td>{{ money(quote.tax_amount) }}</td></tr>
                <tr v-if="quote.tax_mode.value === 'brs'"><td>Retenue BRS ({{ quote.brs_rate }} %)</td><td>− {{ money(quote.tax_amount) }}</td></tr>
                <tr class="grand">
                  <td>{{ quote.tax_mode.value === 'vat' ? 'Total TTC' : quote.tax_mode.value === 'brs' ? 'Net à payer' : 'Total' }}</td>
                  <td>{{ money(quote.total) }}</td>
                </tr>
              </table>
              <table v-if="quote.cost_total !== undefined" class="totals costs">
                <tr><td>Coût total</td><td>{{ money(Math.round(quote.cost_total)) }}</td></tr>
                <tr>
                  <td>Marge</td>
                  <td :class="{ negative: (quote.margin ?? 0) < 0 }">
                    {{ money(quote.margin) }}<template v-if="quote.margin_rate !== null"> ({{ quote.margin_rate }} %)</template>
                  </td>
                </tr>
              </table>
            </template>
          </Card>

          <Card>
            <template #title>Réglages</template>
            <template #content>
              <div class="settings">
                <div class="form-field">
                  <label>Taxe</label>
                  <SelectButton v-model="header.tax_mode" :options="taxOptions" option-label="label" option-value="value" :allow-empty="false" :disabled="!editable" @change="saveHeader('tax_mode')" />
                </div>
                <div class="form-field">
                  <label for="q-discount">Remise (%)</label>
                  <InputNumber v-model="header.discount_rate" input-id="q-discount" :min="0" :max="100" :max-fraction-digits="2" suffix=" %" :disabled="!editable" @blur="saveHeader('discount_rate')" />
                </div>
                <div class="form-field">
                  <label for="q-bank">Compte bancaire imprimé</label>
                  <Select
                    v-if="banks.length"
                    id="q-bank"
                    v-model="header.bank_account_id"
                    :options="[{ id: null, bank_name: 'Aucun' }, ...banks]"
                    option-label="bank_name"
                    option-value="id"
                    :disabled="!editable"
                    @change="saveHeader('bank_account_id')"
                  />
                  <span v-else>{{ quote.bank_account?.bank_name ?? 'Aucun' }}</span>
                </div>
                <label class="switch">
                  <ToggleSwitch v-model="header.show_signature" :disabled="!editable" @update:model-value="saveHeader('show_signature')" />
                  Signature et cachet sur le PDF
                </label>
                <p class="muted small">
                  Créé le {{ formatDate(quote.created_at) }}<template v-if="quote.creator"> par {{ quote.creator.full_name }}</template>.
                </p>
              </div>
            </template>
          </Card>
        </aside>
      </div>

      <QuoteEmailDialog v-model:visible="emailOpen" :quote="quote" @sent="onSent" />
      <InvoiceCreateDialog
        v-if="canInvoice"
        v-model:visible="invoiceOpen"
        :quote="quote"
        :currency="currency"
        @created="(i) => router.push({ name: 'invoice', params: { id: i.id } })"
      />
      <QuoteTemplatePicker v-model:visible="pickerOpen" :sections="sections" :currency="currency" :show-prices="showPrices" @insert="insertTemplate" />
      <Dialog v-model:visible="templateDialog" header="Enregistrer la section comme modèle" modal :style="{ width: '460px' }">
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label for="tpl-name">Nom du modèle</label>
            <InputText id="tpl-name" v-model="templateName" autofocus />
          </div>
          <div class="form-field form-field--full">
            <label for="tpl-system">Système</label>
            <Select id="tpl-system" v-model="templateSystem" :options="[{ id: null, name: 'Sans système' }, ...systems]" option-label="name" option-value="id" />
            <small class="muted">Les systèmes se créent dans Devis → Modèles.</small>
          </div>
        </div>
        <template #footer>
          <Button label="Annuler" severity="secondary" text @click="templateDialog = false" />
          <Button label="Enregistrer" icon="pi pi-check" :disabled="!templateName.trim()" @click="saveTemplate" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.lines-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.lines-toolbar .grow {
  flex: 1;
}
.lines-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}
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

.actions,
.status-bar {
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
  overflow-x: auto;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

.new-section {
  display: flex;
  gap: 0.5rem;
}

.new-section input {
  flex: 1;
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

.costs {
  margin-top: 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.negative {
  color: var(--p-red-500);
}

tr.clickable {
  cursor: pointer;
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
</style>
