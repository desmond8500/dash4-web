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
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
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
import { ApiError, formatMoney } from '@dash4/shared'
import type { Article, Purchase, PurchaseLine, PurchaseLinePayload } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import CommentsPanel from '@/components/CommentsPanel.vue'
import ArticlePicker from '@/components/stock/ArticlePicker.vue'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { formatDateTime } from '@/utils/clientRequests'
import { formatQty, purchaseStatusSeverity, receivedProgress, receptionDraft, receptionPayload } from '@/utils/stock'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const purchase = ref<Purchase | null>(null)
const commentsCount = ref(0)
const loading = ref(true)
const notFound = ref(false)
const busy = ref(false)
const tab = ref(useRoute().query.onglet === 'commentaires' ? 'comments' : 'receptions')
const showCosts = computed(() => auth.can('costs.view'))
const editable = computed(() => !!purchase.value?.can.edit)
const progress = computed(() => (purchase.value ? receivedProgress(purchase.value) : null))
const money = (v: number | undefined) => (v === undefined ? '' : formatMoney(v))

const header = reactive({ title: '', expected: null as Date | null, tax_mode: 'none' as 'vat' | 'none', notes: '' })
function setPurchase(p: Purchase): void {
  purchase.value = p
  Object.assign(header, { title: p.title ?? '', expected: fromApiDate(p.expected_at), tax_mode: p.tax_mode.value === 'vat' ? 'vat' : 'none', notes: p.notes ?? '' })
}

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    setPurchase(await api.purchases.get(Number(props.id)))
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
async function run(action: () => Promise<Purchase>, failure = 'Modification impossible'): Promise<boolean> {
  busy.value = true
  try {
    setPurchase(await action())
    return true
  } catch (e) {
    toast.add({ severity: 'error', summary: failure, detail: errorDetail(e), life: 5000 })
    if (purchase.value) setPurchase(purchase.value)
    return false
  } finally {
    busy.value = false
  }
}
const id = () => purchase.value!.id

function saveHeader(field: 'title' | 'expected' | 'tax_mode' | 'notes'): void {
  if (!purchase.value?.can.update) return
  const payload =
    field === 'expected'
      ? { expected_at: toApiDate(header.expected) }
      : field === 'tax_mode'
        ? { tax_mode: header.tax_mode }
        : { [field]: header[field].trim() || null }
  void run(() => api.purchases.update(id(), payload))
}

// Lignes
const newLine = reactive({ designation: '', quantity: 1 as number | null, unit_cost: 0 as number | null })
function addFromArticle(article: Article): void {
  void run(() => api.purchases.addLine(id(), { article_id: article.id, quantity: newLine.quantity ?? 1 }))
}
function addFree(): void {
  if (!newLine.designation.trim()) return
  const payload: PurchaseLinePayload = {
    designation: newLine.designation.trim(),
    quantity: newLine.quantity ?? 1,
    ...(showCosts.value ? { unit_cost: newLine.unit_cost ?? 0 } : {}),
  }
  void run(() => api.purchases.addLine(id(), payload)).then((ok) => ok && Object.assign(newLine, { designation: '', quantity: 1, unit_cost: 0 }))
}
function updateLine(line: PurchaseLine, field: 'quantity' | 'unit_cost' | 'designation', value: number | string | null): void {
  if (value === null || value === '' || value === line[field]) return
  void run(() => api.purchases.updateLine(line.id, { [field]: value }))
}

// Commande, annulation, suppression
const orderOpen = ref(false)
const orderForm = reactive({ ordered: new Date() as Date | null, expected: null as Date | null })
function openOrder(): void {
  orderForm.ordered = new Date()
  orderForm.expected = header.expected
  orderOpen.value = true
}
async function order(): Promise<void> {
  const ok = await run(() => api.purchases.order(id(), { ordered_at: toApiDate(orderForm.ordered) ?? undefined, expected_at: toApiDate(orderForm.expected) }), 'Commande impossible')
  if (ok) orderOpen.value = false
}
function cancel(): void {
  confirm.require({
    header: "Annuler l'achat",
    message: `Annuler la commande ${purchase.value?.number} ?`,
    acceptProps: { label: "Annuler l'achat", severity: 'danger' },
    rejectProps: { label: 'Retour', severity: 'secondary', text: true },
    accept: () => run(() => api.purchases.cancel(id()), 'Annulation impossible'),
  })
}
function remove(): void {
  confirm.require({
    header: 'Supprimer le brouillon',
    message: `Supprimer le brouillon ${purchase.value?.number} ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.purchases.remove(id())
      void router.push({ name: 'purchases' })
    },
  })
}
async function openPdf(): Promise<void> {
  busy.value = true
  try {
    const url = URL.createObjectURL(await api.purchases.pdf(id()))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    busy.value = false
  }
}

// Réception
const receiveOpen = ref(false)
const reception = reactive({ quantities: {} as Record<number, number | null>, date: new Date() as Date | null, note: '', updateCosts: true })
function openReceive(): void {
  reception.quantities = receptionDraft(purchase.value?.lines ?? [])
  reception.date = new Date()
  reception.note = ''
  reception.updateCosts = true
  receiveOpen.value = true
}
async function receive(): Promise<void> {
  const lines = receptionPayload(reception.quantities)
  if (!lines.length) return
  const ok = await run(
    () => api.purchases.receive(id(), { lines, received_at: toApiDate(reception.date) ?? undefined, note: reception.note.trim() || null, update_costs: reception.updateCosts }),
    'Réception refusée',
  )
  if (ok) {
    receiveOpen.value = false
    tab.value = 'receptions'
    toast.add({ severity: 'success', summary: 'Réception enregistrée', detail: `${purchase.value?.status.label} — le stock est à jour.`, life: 4000 })
  }
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !purchase" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Cet achat n'existe pas, a été supprimé, ou ne fait pas partie de vos achats.</p>
      <RouterLink :to="{ name: 'purchases' }">Retour aux achats</RouterLink>
    </div>

    <template v-else-if="purchase">
      <RouterLink :to="{ name: 'purchases' }" class="back"><i class="pi pi-arrow-left" /> Achats</RouterLink>

      <div class="page-header">
        <div class="title">
          <h1>{{ purchase.number }}</h1>
          <Tag :value="purchase.status.label" :severity="purchaseStatusSeverity(purchase.status.value)" />
          <Tag v-if="purchase.is_late" value="En retard" severity="danger" icon="pi pi-clock" />
          <span class="muted">
            <RouterLink v-if="purchase.provider" :to="{ name: 'provider', params: { id: purchase.provider.id } }">{{ purchase.provider.name }}</RouterLink>
            <template v-if="purchase.project"> · <RouterLink :to="{ name: 'project', params: { id: purchase.project.id } }">{{ purchase.project.name }}</RouterLink></template>
          </span>
        </div>
        <div class="actions">
          <Button v-if="editable && purchase.can.order" label="Commander" icon="pi pi-send" :disabled="busy || !purchase.lines?.length" @click="openOrder" />
          <Button v-if="purchase.can.receive" label="Réceptionner" icon="pi pi-download" severity="success" @click="openReceive" />
          <Button v-if="showCosts" label="Bon de commande" icon="pi pi-file-pdf" severity="secondary" :loading="busy" @click="openPdf" />
          <Button
            v-if="purchase.can.order && ['draft', 'ordered'].includes(purchase.status.value)"
            label="Annuler"
            icon="pi pi-ban"
            severity="secondary"
            outlined
            @click="cancel"
          />
          <Button v-if="purchase.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" @click="remove" />
        </div>
      </div>

      <Message v-if="editable && !purchase.can.order" severity="info" :closable="false">
        Brouillon : ajoutez les lignes et les quantités ; le comptable complète les prix et passe la commande.
      </Message>

      <div class="layout">
        <div class="main">
          <Card>
            <template #content>
              <div class="form-grid">
                <div class="form-field form-field--full">
                  <label for="pu-title">Objet</label>
                  <InputText id="pu-title" v-model="header.title" :disabled="!editable" @change="saveHeader('title')" />
                </div>
              </div>

              <table class="list lines">
                <thead>
                  <tr>
                    <th>Désignation</th>
                    <th class="qty">Commandé</th>
                    <th v-if="!editable" class="qty">Reçu</th>
                    <template v-if="showCosts"><th class="num">Prix d'achat</th><th class="num">Montant</th></template>
                    <th v-if="editable" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="line in purchase.lines" :key="line.id">
                    <td>
                      <InputText v-if="editable && !line.article_id" :model-value="line.designation" fluid @change="updateLine(line, 'designation', ($event.target as HTMLInputElement).value.trim())" />
                      <template v-else>
                        <RouterLink v-if="line.article" :to="{ name: 'article', params: { id: line.article.id } }">{{ line.designation }}</RouterLink>
                        <template v-else>{{ line.designation }}</template>
                      </template>
                      <div v-if="line.article" class="muted small">En stock : {{ formatQty(line.article.quantity) }} {{ line.unit ?? '' }}</div>
                      <div v-else class="muted small">Ligne libre (n'entre pas en stock)</div>
                    </td>
                    <td class="qty">
                      <InputNumber v-if="editable" :model-value="line.quantity" :min="0.01" :max-fraction-digits="2" input-class="qty-input" @update:model-value="(v) => updateLine(line, 'quantity', v)" />
                      <template v-else>{{ formatQty(line.quantity) }} {{ line.unit ?? '' }}</template>
                    </td>
                    <td v-if="!editable" class="qty" :class="{ done: line.remaining_quantity <= 0 }">{{ formatQty(line.received_quantity) }}</td>
                    <template v-if="showCosts">
                      <td class="num">
                        <InputNumber v-if="editable" :model-value="line.unit_cost" :min="0" :max-fraction-digits="2" input-class="price-input" @update:model-value="(v) => updateLine(line, 'unit_cost', v)" />
                        <template v-else>{{ money(line.unit_cost) }}</template>
                      </td>
                      <td class="num">{{ money(line.line_total) }}</td>
                    </template>
                    <td v-if="editable"><Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer la ligne" @click="run(() => api.purchases.removeLine(line.id))" /></td>
                  </tr>
                  <tr v-if="!purchase.lines?.length"><td colspan="6" class="muted">Aucune ligne.</td></tr>
                </tbody>
              </table>

              <div v-if="editable" class="new-lines">
                <div class="row">
                  <InputNumber v-model="newLine.quantity" :min="0.01" :max-fraction-digits="2" placeholder="Qté" input-class="qty-input" />
                  <div class="grow"><ArticlePicker placeholder="Ajouter un article du stock" @select="addFromArticle" /></div>
                </div>
                <form class="row" @submit.prevent="addFree">
                  <InputText v-model="newLine.designation" placeholder="… ou une ligne libre (transport, frais…)" class="grow" />
                  <InputNumber v-if="showCosts" v-model="newLine.unit_cost" :min="0" placeholder="Prix" input-class="price-input" />
                  <Button type="submit" icon="pi pi-plus" label="Ajouter" size="small" :disabled="!newLine.designation.trim()" />
                </form>
                <small class="muted">La quantité saisie à gauche vaut pour la prochaine ligne ajoutée.</small>
              </div>
            </template>
          </Card>

          <Tabs v-model:value="tab">
            <TabList>
              <Tab value="receptions">Réceptions <span v-if="purchase.receptions?.length" class="count">{{ purchase.receptions.length }}</span></Tab>
              <Tab value="documents">Documents (facture fournisseur)</Tab>
              <Tab value="comments">Commentaires <span v-if="commentsCount" class="count">{{ commentsCount }}</span></Tab>
              <Tab value="notes">Notes</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="receptions">
                <div v-if="purchase.receptions?.length" class="receptions">
                  <div v-for="r in purchase.receptions" :key="r.id" class="reception">
                    <strong>{{ formatDateTime(r.received_at) }}</strong>
                    <span class="muted"> · {{ r.receiver?.full_name ?? '—' }}</span>
                    <ul>
                      <li v-for="l in r.lines" :key="l.purchase_line_id">{{ formatQty(l.quantity) }} × {{ l.designation }}</li>
                    </ul>
                    <p v-if="r.note" class="muted small">{{ r.note }}</p>
                  </div>
                </div>
                <p v-else class="muted">Rien de reçu pour le moment.</p>
              </TabPanel>
              <TabPanel value="comments"><CommentsPanel type="purchases" :id="purchase.id" @changed="commentsCount = $event" /></TabPanel>
              <TabPanel v-for="kind in (['documents', 'notes'] as const)" :key="kind" :value="kind">
                <AttachmentsPanel :kind="kind" type="purchases" :id="purchase.id" :can-add="purchase.can.update || purchase.can.receive" :can-manage="purchase.can.order" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        <aside class="side">
          <Card v-if="showCosts">
            <template #title>Totaux</template>
            <template #content>
              <table class="totals">
                <tr><td>Total hors taxes</td><td>{{ money(purchase.subtotal) }}</td></tr>
                <tr v-if="purchase.tax_mode.value === 'vat'"><td>TVA ({{ purchase.vat_rate }} %)</td><td>{{ money(purchase.tax_amount) }}</td></tr>
                <tr class="grand"><td>{{ purchase.tax_mode.value === 'vat' ? 'Total TTC' : 'Total' }}</td><td>{{ money(purchase.total) }}</td></tr>
              </table>
            </template>
          </Card>
          <Card>
            <template #title>Suivi</template>
            <template #content>
              <div class="settings">
                <p v-if="progress && purchase.status.value !== 'draft'" class="small">Reçu : {{ formatQty(progress.received) }} sur {{ formatQty(progress.ordered) }}</p>
                <p v-if="purchase.ordered_at" class="muted small">Commandé le {{ formatDate(purchase.ordered_at) }}</p>
                <div class="form-field">
                  <label for="pu-expected">Livraison prévue le</label>
                  <DatePicker id="pu-expected" v-model="header.expected" date-format="dd/mm/yy" show-button-bar :disabled="!purchase.can.update" @update:model-value="saveHeader('expected')" />
                </div>
                <div v-if="showCosts" class="form-field">
                  <label for="pu-tax">Taxe</label>
                  <Select id="pu-tax" v-model="header.tax_mode" :options="[{ value: 'none', label: 'Sans taxe' }, { value: 'vat', label: 'TVA' }]" option-label="label" option-value="value" :disabled="!editable" @change="saveHeader('tax_mode')" />
                </div>
                <div class="form-field">
                  <label for="pu-notes">Notes internes</label>
                  <MarkdownEditor id="pu-notes" v-model="header.notes" rows="3" auto-resize :disabled="!purchase.can.update" @change="saveHeader('notes')" />
                </div>
              </div>
            </template>
          </Card>
        </aside>
      </div>

      <Dialog v-model:visible="orderOpen" header="Passer la commande" modal :style="{ width: '420px' }">
        <div class="form-grid">
          <div class="form-field form-field--full"><label for="o-date">Commandé le</label><DatePicker id="o-date" v-model="orderForm.ordered" date-format="dd/mm/yy" /></div>
          <div class="form-field form-field--full"><label for="o-exp">Livraison prévue le</label><DatePicker id="o-exp" v-model="orderForm.expected" date-format="dd/mm/yy" show-button-bar /></div>
          <p class="form-field--full muted small">Les lignes ne se modifient plus ensuite. Envoyez le bon de commande (PDF) au fournisseur.</p>
        </div>
        <template #footer>
          <Button label="Annuler" severity="secondary" text @click="orderOpen = false" />
          <Button label="Commander" icon="pi pi-send" :loading="busy" @click="order" />
        </template>
      </Dialog>

      <Dialog v-model:visible="receiveOpen" header="Réceptionner" modal :style="{ width: '640px' }" :breakpoints="{ '680px': '95vw' }">
        <table class="list">
          <thead><tr><th>Article</th><th class="num">Reste</th><th class="num">Reçu maintenant</th></tr></thead>
          <tbody>
            <tr v-for="line in (purchase.lines ?? []).filter((l) => l.remaining_quantity > 0)" :key="line.id">
              <td>{{ line.designation }}<div v-if="!line.article_id" class="muted small">Ligne libre</div></td>
              <td class="num">{{ formatQty(line.remaining_quantity) }}</td>
              <td class="num">
                <InputNumber v-model="reception.quantities[line.id]" :min="0" :max="line.remaining_quantity" :max-fraction-digits="2" input-class="qty-input" />
              </td>
            </tr>
          </tbody>
        </table>
        <div class="form-grid reception-form">
          <div class="form-field"><label for="r-date">Date</label><DatePicker id="r-date" v-model="reception.date" date-format="dd/mm/yy" :max-date="new Date()" /></div>
          <div class="form-field"><label for="r-note">Remarque</label><InputText id="r-note" v-model="reception.note" placeholder="Carton abîmé, reliquat…" /></div>
          <label v-if="showCosts" class="form-field--full check">
            <Checkbox v-model="reception.updateCosts" binary /> Mettre le coût des articles au prix de cet achat
          </label>
        </div>
        <template #footer>
          <Button label="Annuler" severity="secondary" text @click="receiveOpen = false" />
          <Button label="Enregistrer la réception" icon="pi pi-check" :loading="busy" :disabled="!receptionPayload(reception.quantities).length" @click="receive" />
        </template>
      </Dialog>
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

.title,
.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.title h1 {
  margin: 0;
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

.main,
.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.lines {
  margin-top: 1rem;
}

.lines .qty {
  width: 8rem;
}

.done {
  color: var(--p-green-600);
  font-weight: 600;
}

.new-lines {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.grow {
  flex: 1;
  min-width: 14rem;
}

:deep(.qty-input) {
  width: 5.5rem;
}

:deep(.price-input) {
  width: 8rem;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}

.receptions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reception ul {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
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

.settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings p {
  margin: 0;
}

.reception-form {
  margin-top: 1rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.small {
  font-size: 0.85rem;
}
</style>
