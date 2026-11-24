<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { ApiError, alertText, fleetSeverity, formatKm, formatMoney, vehicleSubtitle } from '@dash4/shared'
import type { Expense, MaintenanceType, Vehicle, VehicleMaintenance, VehicleOptions, VehiclePaper, VehiclePaperType } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { intOrNull, vehicleIcon } from '@/utils/fleet'
import MarkdownView from '@/components/MarkdownView.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import CommentsPanel from '@/components/CommentsPanel.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'
import RecordPhoto from '@/components/RecordPhoto.vue'
import ExpenseTable from '@/components/accounting/ExpenseTable.vue'
import ExpenseDialog from '@/components/accounting/ExpenseDialog.vue'
import VehicleFormDialog from '@/components/fleet/VehicleFormDialog.vue'

/** Fiche d'un véhicule : caractéristiques, papiers, compteur, entretiens, dépenses, documents. */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const settings = useSettingsStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()

const vehicle = ref<Vehicle | null>(null)
const options = ref<VehicleOptions | null>(null)
const notFound = ref(false)
const TABS = ['fiche', 'photos', 'papiers', 'compteur', 'entretiens', 'depenses', 'documents', 'commentaires']
const photosCount = ref<number | null>(null)
const tab = ref(TABS.includes(String(route.query.onglet)) ? String(route.query.onglet) : 'fiche')
watch(tab, (t) => void router.replace({ query: { ...route.query, onglet: t } }))

const canUpdate = computed(() => !!vehicle.value?.can.update)
const canCosts = computed(() => auth.can('costs.view'))
const canExpenses = computed(() => auth.canAny(['accounting.view', 'accounting.view.own']))
const money = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatMoney(v, settings.currency()))
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  try {
    vehicle.value = await api.vehicles.get(Number(props.id))
  } catch {
    notFound.value = true
  }
}
onMounted(async () => {
  void settings.load()
  await load()
  options.value = await api.vehicles.options().catch(() => null)
})
watch(() => props.id, load)

async function run(action: () => Promise<Vehicle>, done?: string): Promise<boolean> {
  try {
    vehicle.value = await action()
    if (done) toast.add({ severity: 'success', summary: done, life: 2500 })
    return true
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Refusé', detail: errorDetail(e), life: 6000 })
    return false
  }
}

// --- Fiche ---------------------------------------------------------------------------------
const editOpen = ref(false)
function removeVehicle(): void {
  confirm.require({
    header: 'Supprimer le véhicule',
    message: `Supprimer « ${vehicle.value!.name} » du parc ? Ses dépenses restent dans la comptabilité.`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.vehicles.remove(vehicle.value!.id)
      void router.push({ name: 'vehicles' })
    },
  })
}

// --- Papiers -------------------------------------------------------------------------------
const showHistory = ref(false)
const papers = computed(() => (vehicle.value?.papers ?? []).filter((p) => showHistory.value || p.current))
const paperDialog = ref(false)
const paperEdited = ref<VehiclePaper | null>(null)
const paperForm = ref({ type: 'insurance' as VehiclePaperType, label: '', number: '', provider: '', issued: null as Date | null, expires: null as Date | null, cost: null as number | null, notes: '' })
const scansFor = ref<VehiclePaper | null>(null)

function openPaper(p: VehiclePaper | null, renew = false): void {
  paperEdited.value = renew ? null : p
  paperForm.value = {
    type: p?.type.value ?? 'insurance', label: p?.label ?? '', number: renew ? '' : (p?.number ?? ''), provider: p?.provider ?? '',
    issued: renew ? (p?.expires_on ? fromApiDate(p.expires_on) : new Date()) : fromApiDate(p?.issued_on ?? null),
    expires: renew ? null : fromApiDate(p?.expires_on ?? null), cost: renew ? null : (p?.cost ?? null), notes: renew ? '' : (p?.notes ?? ''),
  }
  paperDialog.value = true
}
async function savePaper(): Promise<void> {
  const f = paperForm.value
  const payload = {
    type: f.type, label: f.label.trim() || null, number: f.number.trim() || null, provider: f.provider.trim() || null,
    issued_on: toApiDate(f.issued), expires_on: toApiDate(f.expires), notes: f.notes.trim() || null,
    ...(canCosts.value ? { cost: intOrNull(f.cost) } : {}),
  }
  const id = vehicle.value!.id
  const p = paperEdited.value
  if (await run(() => (p ? api.vehicles.updatePaper(id, p.id, payload) : api.vehicles.addPaper(id, payload)), 'Papier enregistré')) paperDialog.value = false
}
function removePaper(p: VehiclePaper): void {
  confirm.require({
    header: 'Supprimer le papier',
    message: `Supprimer « ${p.title} » et ses scans ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => void run(() => api.vehicles.removePaper(vehicle.value!.id, p.id)),
  })
}

// --- Compteur ------------------------------------------------------------------------------
const mileageForm = ref({ km: null as number | null, date: new Date() as Date | null, note: '' })
async function addMileage(): Promise<void> {
  const f = mileageForm.value
  if (f.km === null) return
  const ok = await run(
    () => api.vehicles.addMileage(vehicle.value!.id, { km: intOrNull(f.km)!, read_on: toApiDate(f.date) ?? undefined, note: f.note.trim() || null, client_uuid: crypto.randomUUID() }),
    'Relevé enregistré',
  )
  if (ok) mileageForm.value = { km: null, date: new Date(), note: '' }
}
/** Moyenne mensuelle entre le premier et le dernier relevé. */
const monthlyKm = computed(() => {
  const list = vehicle.value?.mileages ?? []
  if (list.length < 2) return null
  const last = list[0]!
  const first = list[list.length - 1]!
  const days = (new Date(last.read_on).getTime() - new Date(first.read_on).getTime()) / 86_400_000
  return days >= 20 ? Math.round(((last.km - first.km) / days) * 30) : null
})
function removeMileage(id: number): void {
  void run(() => api.vehicles.removeMileage(vehicle.value!.id, id))
}

// --- Entretiens ----------------------------------------------------------------------------
const maintDialog = ref(false)
const maintEdited = ref<VehicleMaintenance | null>(null)
const maintForm = ref({
  type: 'oil_change' as MaintenanceType, done: new Date() as Date | null, km: null as number | null, garage: '', description: '', cost: null as number | null,
  nextOn: null as Date | null, nextKm: null as number | null, createExpense: true,
})
function openMaintenance(m: VehicleMaintenance | null): void {
  maintEdited.value = m
  maintForm.value = {
    type: m?.type.value ?? 'oil_change', done: m ? fromApiDate(m.done_on) : new Date(), km: m?.km ?? vehicle.value?.mileage ?? null, garage: m?.garage ?? '',
    description: m?.description ?? '', cost: m?.cost ?? null, nextOn: fromApiDate(m?.next_on ?? null), nextKm: m?.next_km ?? null,
    createExpense: auth.can('accounting.create'),
  }
  maintDialog.value = true
}
async function saveMaintenance(): Promise<void> {
  const f = maintForm.value
  if (!f.done) return
  const payload = {
    type: f.type, done_on: toApiDate(f.done)!, km: intOrNull(f.km), garage: f.garage.trim() || null, description: f.description.trim() || null,
    next_on: toApiDate(f.nextOn), next_km: intOrNull(f.nextKm),
    ...(canCosts.value ? { cost: intOrNull(f.cost) } : {}),
  }
  const id = vehicle.value!.id
  const m = maintEdited.value
  const ok = await run(
    () => (m ? api.vehicles.updateMaintenance(id, m.id, payload) : api.vehicles.addMaintenance(id, { ...payload, create_expense: canCosts.value && f.createExpense && !!f.cost })),
    'Entretien enregistré',
  )
  if (ok) {
    maintDialog.value = false
    void loadExpenses()
  }
}
function removeMaintenance(m: VehicleMaintenance): void {
  confirm.require({
    header: "Supprimer l'entretien",
    message: `Supprimer « ${m.type.label} » du ${formatDate(m.done_on)} ?${m.expense_id ? ' La dépense liée reste dans la comptabilité.' : ''}`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => void run(() => api.vehicles.removeMaintenance(vehicle.value!.id, m.id)),
  })
}

// --- Dépenses ------------------------------------------------------------------------------
const expenses = ref<Expense[]>([])
const expensesLoading = ref(false)
const expenseDialog = ref(false)
const expenseEdited = ref<Expense | null>(null)
async function loadExpenses(): Promise<void> {
  if (!canExpenses.value || !vehicle.value) return
  expensesLoading.value = true
  try {
    expenses.value = (await api.expenses.list({ vehicle_id: vehicle.value.id, per_page: 200 })).data
  } finally {
    expensesLoading.value = false
  }
}
watch(tab, (t) => {
  if (t === 'depenses') void loadExpenses()
}, { immediate: true })
function onExpenseSaved(): void {
  void loadExpenses()
  void load()
}
</script>

<template>
  <div class="page">
    <div v-if="notFound" class="muted">Véhicule introuvable ou réservé.</div>
    <div v-else-if="!vehicle" class="center"><ProgressSpinner /></div>
    <template v-else>
      <div class="page-header">
        <Button icon="pi pi-arrow-left" text rounded aria-label="Retour au parc" @click="router.push({ name: 'vehicles' })" />
        <RecordPhoto
          :url="vehicle.photo_url"
          :alt="`Photo de ${vehicle.name}`"
          :icon="vehicleIcon(vehicle.kind.value)"
          :can-edit="vehicle.can.add_photos"
          size="96px"
          :upload="async (f) => (vehicle = await api.photos.upload('vehicles', vehicle!.id, f, f.name))"
          :remove="async () => (vehicle = await api.photos.remove('vehicles', vehicle!.id))"
        />
        <div class="grow">
          <h1>{{ vehicle.name }}</h1>
          <div class="muted">{{ vehicleSubtitle(vehicle) || vehicle.kind.label }}</div>
        </div>
        <Tag :value="vehicle.status.label" :severity="vehicle.status.value === 'active' ? 'success' : vehicle.status.value === 'repair' ? 'warn' : 'secondary'" />
        <Button v-if="canUpdate" label="Modifier" icon="pi pi-pencil" text @click="editOpen = true" />
        <Button v-if="vehicle.can.delete" icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="removeVehicle" />
      </div>

      <div class="summary">
        <div><span class="muted small">Compteur</span><strong>{{ formatKm(vehicle.mileage) }}</strong></div>
        <div><span class="muted small">Conducteur</span><strong>{{ vehicle.driver?.full_name ?? 'Véhicule partagé' }}</strong></div>
        <div v-if="vehicle.costs"><span class="muted small">Coût cette année</span><strong>{{ money(vehicle.costs.this_year) }}</strong></div>
        <div v-if="vehicle.costs"><span class="muted small">Coût total</span><strong>{{ money(vehicle.costs.total) }}</strong></div>
      </div>
      <div v-if="vehicle.alerts?.length" class="alerts">
        <Message v-for="(a, i) in vehicle.alerts" :key="i" :severity="fleetSeverity(a.state) === 'danger' ? 'error' : 'warn'" :closable="false">
          <i :class="a.kind === 'paper' ? 'pi pi-id-card' : 'pi pi-wrench'" /> {{ alertText(a) }}
        </Message>
      </div>

      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="fiche">Fiche</Tab>
          <Tab value="photos">Photos <span v-if="photosCount" class="count">{{ photosCount }}</span></Tab>
          <Tab value="papiers">Papiers <span class="count">{{ (vehicle.papers ?? []).filter((p) => p.current).length }}</span></Tab>
          <Tab value="compteur">Kilométrage</Tab>
          <Tab value="entretiens">Entretiens <span class="count">{{ vehicle.maintenances?.length ?? 0 }}</span></Tab>
          <Tab v-if="canExpenses" value="depenses">Dépenses</Tab>
          <Tab value="documents">Documents</Tab>
          <Tab value="commentaires">Commentaires</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="fiche">
            <div class="grid">
              <Card>
                <template #title>Caractéristiques</template>
                <template #content>
                  <dl class="facts">
                    <dt>Type</dt><dd>{{ vehicle.kind.label }}</dd>
                    <template v-if="vehicle.brand || vehicle.model"><dt>Marque, modèle</dt><dd>{{ [vehicle.brand, vehicle.model].filter(Boolean).join(' ') }}</dd></template>
                    <template v-if="vehicle.plate"><dt>Immatriculation</dt><dd>{{ vehicle.plate }}</dd></template>
                    <template v-if="vehicle.vin"><dt>N° de châssis</dt><dd>{{ vehicle.vin }}</dd></template>
                    <template v-if="vehicle.year"><dt>Année</dt><dd>{{ vehicle.year }}</dd></template>
                    <template v-if="vehicle.color"><dt>Couleur</dt><dd>{{ vehicle.color }}</dd></template>
                    <template v-if="vehicle.fuel"><dt>Énergie</dt><dd>{{ vehicle.fuel.label }}</dd></template>
                    <template v-if="vehicle.fiscal_power"><dt>Puissance fiscale</dt><dd>{{ vehicle.fiscal_power }} CV</dd></template>
                    <template v-if="vehicle.seats"><dt>Places</dt><dd>{{ vehicle.seats }}</dd></template>
                    <template v-for="(c, i) in vehicle.characteristics" :key="i"><dt>{{ c.label }}</dt><dd>{{ c.value || '—' }}</dd></template>
                    <template v-if="vehicle.acquired_on"><dt>Mis en service le</dt><dd>{{ formatDate(vehicle.acquired_on) }}</dd></template>
                    <template v-if="vehicle.purchase_price !== undefined && vehicle.purchase_price !== null"><dt>Prix d'achat</dt><dd>{{ money(vehicle.purchase_price) }}</dd></template>
                    <template v-if="vehicle.service_interval_km || vehicle.service_interval_months">
                      <dt>Révision</dt>
                      <dd>tous les {{ [vehicle.service_interval_km ? formatKm(vehicle.service_interval_km) : null, vehicle.service_interval_months ? `${vehicle.service_interval_months} mois` : null].filter(Boolean).join(' ou ') }}</dd>
                    </template>
                  </dl>
                  <MarkdownView v-if="vehicle.notes" :text="vehicle.notes" class="notes" />
                </template>
              </Card>
              <Card v-if="vehicle.costs">
                <template #title>Coûts</template>
                <template #content>
                  <dl class="facts">
                    <dt>Papiers</dt><dd>{{ money(vehicle.costs.papers) }}</dd>
                    <dt>Entretiens (hors dépenses)</dt><dd>{{ money(vehicle.costs.maintenance) }}</dd>
                    <dt>Dépenses liées</dt><dd>{{ money(vehicle.costs.expenses) }}</dd>
                    <dt><strong>Total</strong></dt><dd><strong>{{ money(vehicle.costs.total) }}</strong></dd>
                    <dt>Dont cette année</dt><dd>{{ money(vehicle.costs.this_year) }}</dd>
                  </dl>
                </template>
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="photos">
            <p class="muted small">État du véhicule, dégâts, compteur, papiers… Le conducteur attitré peut aussi en ajouter depuis son téléphone.</p>
            <PhotoGallery type="vehicles" :id="vehicle.id" :can-add="vehicle.can.add_photos" :can-manage="vehicle.can.delete" @changed="(n) => (photosCount = n)" />
          </TabPanel>

          <TabPanel value="papiers">
            <div class="tab-actions">
              <label class="check"><Checkbox v-model="showHistory" binary /> Voir aussi les anciens papiers</label>
              <span class="grow" />
              <Button v-if="canUpdate" label="Ajouter un papier" icon="pi pi-plus" size="small" @click="openPaper(null)" />
            </div>
            <DataTable :value="papers" data-key="id" striped-rows>
              <template #empty>Aucun papier enregistré (assurance, carte grise, CMC, visite technique…).</template>
              <Column header="Papier">
                <template #body="{ data }">
                  <strong>{{ data.title }}</strong>
                  <Tag v-if="!data.current" value="Remplacé" severity="secondary" class="ml" />
                  <div class="muted small">{{ [data.number, data.provider].filter(Boolean).join(' · ') }}</div>
                </template>
              </Column>
              <Column header="Délivré le" style="width: 9rem"><template #body="{ data }">{{ data.issued_on ? formatDate(data.issued_on) : '—' }}</template></Column>
              <Column header="Expire le" style="width: 11rem">
                <template #body="{ data }">
                  <template v-if="data.expires_on">
                    {{ formatDate(data.expires_on) }}
                    <Tag v-if="data.current && data.state !== 'ok'" :value="data.state === 'expired' ? 'Dépassé' : 'Bientôt'" :severity="fleetSeverity(data.state)" class="ml" />
                  </template>
                  <span v-else class="muted">Sans échéance</span>
                </template>
              </Column>
              <Column v-if="canCosts" header="Coût" style="width: 8rem"><template #body="{ data }">{{ money(data.cost) }}</template></Column>
              <Column header="" style="width: 12rem">
                <template #body="{ data }">
                  <Button icon="pi pi-paperclip" text rounded :label="data.documents_count ? String(data.documents_count) : undefined" aria-label="Scans" @click="scansFor = data" />
                  <template v-if="canUpdate">
                    <Button v-if="data.current" icon="pi pi-refresh" text rounded aria-label="Renouveler" title="Renouveler" @click="openPaper(data, true)" />
                    <Button icon="pi pi-pencil" text rounded aria-label="Modifier" @click="openPaper(data)" />
                    <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="removePaper(data)" />
                  </template>
                </template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel value="compteur">
            <form v-if="vehicle.can.record_mileage" class="mileage-form" @submit.prevent="addMileage">
              <div class="form-field"><label for="m-km">Compteur</label><InputNumber v-model="mileageForm.km" input-id="m-km" :min="0" suffix=" km" /></div>
              <div class="form-field"><label for="m-date">Date</label><DatePicker v-model="mileageForm.date" input-id="m-date" date-format="dd/mm/yy" :max-date="new Date()" /></div>
              <div class="form-field grow"><label for="m-note">Note</label><InputText id="m-note" v-model="mileageForm.note" placeholder="Plein, trajet…" /></div>
              <Button type="submit" label="Enregistrer le relevé" icon="pi pi-check" :disabled="mileageForm.km === null" />
            </form>
            <p v-if="monthlyKm !== null" class="muted">Environ {{ formatKm(monthlyKm) }} par mois.</p>
            <DataTable :value="vehicle.mileages ?? []" data-key="id" striped-rows>
              <template #empty>Aucun relevé.</template>
              <Column header="Date" style="width: 9rem"><template #body="{ data }">{{ formatDate(data.read_on) }}</template></Column>
              <Column header="Compteur" style="width: 10rem"><template #body="{ data }"><strong>{{ formatKm(data.km) }}</strong></template></Column>
              <Column header="Note"><template #body="{ data }">{{ data.note }}</template></Column>
              <Column header="Par"><template #body="{ data }"><span class="muted">{{ data.creator?.full_name }}</span></template></Column>
              <Column v-if="canUpdate" header="" style="width: 4rem">
                <template #body="{ data }"><Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer le relevé" @click="removeMileage(data.id)" /></template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel value="entretiens">
            <div v-if="vehicle.upcoming?.length" class="upcoming">
              <h3>Prochains entretiens</h3>
              <div v-for="u in vehicle.upcoming" :key="u.type" class="upcoming-item">
                <Tag :value="u.state === 'late' ? 'En retard' : u.state === 'soon' ? 'Bientôt' : 'Prévu'" :severity="fleetSeverity(u.state)" />
                <strong>{{ u.label }}</strong>
                <span class="muted">{{ [u.next_on ? `le ${formatDate(u.next_on)}` : null, u.next_km ? `à ${formatKm(u.next_km)}` : null].filter(Boolean).join(' ou ') }}</span>
              </div>
            </div>
            <div class="tab-actions">
              <span class="grow" />
              <Button v-if="canUpdate" label="Noter un entretien" icon="pi pi-plus" size="small" @click="openMaintenance(null)" />
            </div>
            <DataTable :value="vehicle.maintenances ?? []" data-key="id" striped-rows>
              <template #empty>Aucun entretien noté.</template>
              <Column header="Date" style="width: 9rem"><template #body="{ data }">{{ formatDate(data.done_on) }}</template></Column>
              <Column header="Entretien">
                <template #body="{ data }">
                  <strong>{{ data.type.label }}</strong><span v-if="data.garage" class="muted"> · {{ data.garage }}</span>
                  <MarkdownView v-if="data.description" :text="data.description" class="small" />
                </template>
              </Column>
              <Column header="Compteur" style="width: 9rem"><template #body="{ data }">{{ formatKm(data.km) }}</template></Column>
              <Column header="Prochain" style="width: 12rem">
                <template #body="{ data }">
                  <span class="muted small">{{ [data.next_on ? formatDate(data.next_on) : null, data.next_km ? formatKm(data.next_km) : null].filter(Boolean).join(' · ') || '—' }}</span>
                </template>
              </Column>
              <Column v-if="canCosts" header="Coût" style="width: 9rem">
                <template #body="{ data }">{{ money(data.cost) }}<i v-if="data.expense_id" class="pi pi-wallet muted ml" title="Enregistré en dépense" /></template>
              </Column>
              <Column v-if="canUpdate" header="" style="width: 7rem">
                <template #body="{ data }">
                  <Button icon="pi pi-pencil" text rounded aria-label="Modifier" @click="openMaintenance(data)" />
                  <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="removeMaintenance(data)" />
                </template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel v-if="canExpenses" value="depenses">
            <div class="tab-actions">
              <span class="muted small">Carburant, péage, lavage, réparations… rattachés à ce véhicule.</span>
              <span class="grow" />
              <Button label="Nouvelle dépense" icon="pi pi-plus" size="small" @click="(expenseEdited = null), (expenseDialog = true)" />
            </div>
            <ExpenseTable searchable :expenses="expenses" :loading="expensesLoading" @open="(e) => ((expenseEdited = e), (expenseDialog = true))" />
            <ExpenseDialog v-model:visible="expenseDialog" :expense="expenseEdited" :vehicle-id="vehicle.id" @saved="onExpenseSaved" @removed="onExpenseSaved" />
          </TabPanel>

          <TabPanel value="documents">
            <AttachmentsPanel kind="documents" type="vehicles" :id="vehicle.id" :can-add="canUpdate" :can-manage="!!vehicle.can.delete" />
            <h3>Notes</h3>
            <AttachmentsPanel kind="notes" type="vehicles" :id="vehicle.id" :can-add="canUpdate" :can-manage="!!vehicle.can.delete" />
          </TabPanel>
          <TabPanel value="commentaires"><CommentsPanel type="vehicles" :id="vehicle.id" /></TabPanel>
        </TabPanels>
      </Tabs>

      <VehicleFormDialog v-model:visible="editOpen" :vehicle="vehicle" :options="options" @saved="(v) => (vehicle = v)" />

      <Dialog v-model:visible="paperDialog" :header="paperEdited ? 'Modifier le papier' : 'Nouveau papier'" modal :style="{ width: '560px' }">
        <form id="paper-form" class="form-grid" @submit.prevent="savePaper">
          <div class="form-field"><label for="p-type">Type</label><Select id="p-type" v-model="paperForm.type" :options="options?.paper_types ?? []" option-label="label" option-value="value" /></div>
          <div class="form-field"><label for="p-label">Intitulé (facultatif)</label><InputText id="p-label" v-model="paperForm.label" placeholder="Assurance tous risques" /></div>
          <div class="form-field"><label for="p-number">Numéro</label><InputText id="p-number" v-model="paperForm.number" /></div>
          <div class="form-field"><label for="p-provider">Organisme</label><InputText id="p-provider" v-model="paperForm.provider" placeholder="Assureur, centre de contrôle…" /></div>
          <div class="form-field"><label for="p-issued">Délivré le</label><DatePicker v-model="paperForm.issued" input-id="p-issued" date-format="dd/mm/yy" show-button-bar /></div>
          <div class="form-field"><label for="p-expires">Expire le</label><DatePicker v-model="paperForm.expires" input-id="p-expires" date-format="dd/mm/yy" show-button-bar /></div>
          <div v-if="canCosts" class="form-field"><label for="p-cost">Coût</label><InputNumber v-model="paperForm.cost" input-id="p-cost" :min="0" suffix=" F" /></div>
          <div class="form-field form-field--full"><label for="p-notes">Notes</label><MarkdownEditor id="p-notes" v-model="paperForm.notes" rows="2" /></div>
          <p class="form-field--full muted small">Les scans se joignent ensuite avec le trombone de la ligne. Une alerte part 30 jours puis 7 jours avant l'échéance.</p>
        </form>
        <template #footer>
          <Button label="Annuler" text severity="secondary" @click="paperDialog = false" />
          <Button label="Enregistrer" icon="pi pi-check" type="submit" form="paper-form" />
        </template>
      </Dialog>

      <Dialog :visible="!!scansFor" :header="`Scans — ${scansFor?.title ?? ''}`" modal :style="{ width: '640px' }" @update:visible="(v) => !v && ((scansFor = null), load())">
        <AttachmentsPanel v-if="scansFor" kind="documents" type="vehicle-papers" :id="scansFor.id" :can-add="canUpdate" :can-manage="!!vehicle.can.delete" />
      </Dialog>

      <Dialog v-model:visible="maintDialog" :header="maintEdited ? 'Modifier l\'entretien' : 'Noter un entretien'" modal :style="{ width: '600px' }">
        <form id="maint-form" class="form-grid" @submit.prevent="saveMaintenance">
          <div class="form-field"><label for="mt-type">Entretien</label><Select id="mt-type" v-model="maintForm.type" :options="options?.maintenance_types ?? []" option-label="label" option-value="value" /></div>
          <div class="form-field"><label for="mt-date">Fait le</label><DatePicker v-model="maintForm.done" input-id="mt-date" date-format="dd/mm/yy" :max-date="new Date()" /></div>
          <div class="form-field"><label for="mt-km">Compteur</label><InputNumber v-model="maintForm.km" input-id="mt-km" :min="0" suffix=" km" /></div>
          <div class="form-field"><label for="mt-garage">Garage</label><InputText id="mt-garage" v-model="maintForm.garage" /></div>
          <div v-if="canCosts" class="form-field"><label for="mt-cost">Coût</label><InputNumber v-model="maintForm.cost" input-id="mt-cost" :min="0" suffix=" F" /></div>
          <label v-if="canCosts && !maintEdited && auth.can('accounting.create')" class="check form-field">
            <Checkbox v-model="maintForm.createExpense" binary /> Enregistrer aussi en dépense
          </label>
          <div class="form-field form-field--full"><label for="mt-desc">Travaux faits</label><MarkdownEditor id="mt-desc" v-model="maintForm.description" rows="3" /></div>
          <div class="form-field"><label for="mt-next">Prochain le</label><DatePicker v-model="maintForm.nextOn" input-id="mt-next" date-format="dd/mm/yy" show-button-bar /></div>
          <div class="form-field"><label for="mt-nextkm">… ou à</label><InputNumber v-model="maintForm.nextKm" input-id="mt-nextkm" :min="0" suffix=" km" /></div>
          <p v-if="(maintForm.type === 'oil_change' || maintForm.type === 'service') && (vehicle.service_interval_km || vehicle.service_interval_months)" class="form-field--full muted small">
            Sans prochain entretien indiqué, la révision est calculée avec l'intervalle du véhicule.
          </p>
        </form>
        <template #footer>
          <Button label="Annuler" text severity="secondary" @click="maintDialog = false" />
          <Button label="Enregistrer" icon="pi pi-check" type="submit" form="maint-form" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.kind-icon {
  font-size: 1.75rem;
  color: var(--p-primary-color);
}
.grow {
  flex: 1;
}
.summary {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.summary > div {
  display: flex;
  flex-direction: column;
}
.alerts {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}
.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.375rem 1rem;
  margin: 0;
}
.facts dt {
  color: var(--p-text-muted-color);
}
.facts dd {
  margin: 0;
}
.notes {
  margin-top: 1rem;
}
.tab-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ml {
  margin-left: 0.375rem;
}
.small {
  font-size: 0.85rem;
}
.mileage-form {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.upcoming {
  margin-bottom: 1rem;
}
.upcoming-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.25rem 0;
}
.count {
  margin-left: 0.25rem;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
.center {
  display: flex;
  justify-content: center;
  padding: 3rem;
}
</style>
