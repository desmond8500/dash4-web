<script setup lang="ts">
import { openFile } from '@/utils/files'
import { markdownToText } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, equipmentTotals, equipmentTree, placeLabel } from '@dash4/shared'
import type { Equipment, InstalledSystem, Site, SiteSystem } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate, toApiDate } from '@/utils/projects'
import { equipmentStatusSeverity, progressColor } from '@/utils/site'
import EquipmentDialog from './EquipmentDialog.vue'
import PlansPanel from './PlansPanel.vue'
import QuantitiesPanel from './QuantitiesPanel.vue'
import SheetsPanel from './SheetsPanel.vue'
import SelectButton from 'primevue/selectbutton'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import QuoteSiteDialog from '@/components/quotes/QuoteSiteDialog.vue'

/** Chantier d'un projet : bâtiments, niveaux et pièces ; systèmes installés, avancement et équipements. */
const props = defineProps<{ projectId: number }>()
const emit = defineEmits<{ loaded: [site: Site] }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const site = ref<Site | null>(null)
const view = ref<'installation' | 'plans' | 'quantities' | 'sheets'>('installation')
const views = [
  { value: 'installation', label: 'Installation' },
  { value: 'plans', label: 'Plans' },
  { value: 'quantities', label: 'Quantitatifs' },
  { value: 'sheets', label: 'Fiches' },
]
const doeLoading = ref(false)
async function openDoe(): Promise<void> {
  doeLoading.value = true
  try {
    openFile(await api.doe(props.projectId))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'DOE impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    doeLoading.value = false
  }
}
const loading = ref(true)
const catalog = ref<SiteSystem[]>([])
const openSystems = ref<Record<number, boolean>>({})

const can = computed(() => site.value?.can ?? { manage: false, create: false, delete: false })
const buildingName = (id: number | null) => site.value?.buildings.find((b) => b.id === id)?.name ?? null

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
function set(s: Site): void {
  site.value = s
  emit('loaded', s)
}
async function run(action: () => Promise<Site>, failure = 'Action impossible'): Promise<boolean> {
  try {
    set(await action())
    return true
  } catch (e) {
    toast.add({ severity: 'error', summary: failure, detail: errorDetail(e), life: 5000 })
    return false
  }
}
async function load(): Promise<void> {
  loading.value = true
  try {
    set(await api.sites.get(props.projectId))
    if (site.value!.systems.length <= 3) site.value!.systems.forEach((s) => (openSystems.value[s.id] = true))
  } catch {
    site.value = null
  } finally {
    loading.value = false
  }
}
watch(() => props.projectId, load, { immediate: true })

function confirmDelete(label: string, action: () => Promise<Site>): void {
  confirm.require({
    header: 'Supprimer',
    message: `Supprimer ${label} ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => void run(action, 'Suppression impossible'),
  })
}

// Appareils depuis un devis du projet ; éclater un groupe en appareils identiques
const fromQuoteOpen = ref(false)
const canFromQuote = computed(() => can.value.manage && auth.canAny(['quotes.view', 'quotes.view.own']))
function confirmSplit(e: Equipment): void {
  confirm.require({
    header: 'Éclater le groupe',
    message: `Créer ${e.quantity} appareils « ${e.name} » de quantité 1, avec les mêmes informations ? Le n° de série, les sous-équipements et les pièces jointes restent sur le premier.`,
    acceptProps: { label: `Éclater en ${e.quantity}` },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => void run(() => api.sites.splitEquipment(e.id), 'Éclatement impossible'),
  })
}

// --- Bâtiments, niveaux, pièces : ajout et renommage dans une petite fenêtre
const place = ref<{ open: boolean; title: string; name: string; description: string; save: (name: string, description: string | null) => Promise<Site> }>({
  open: false, title: '', name: '', description: '', save: () => Promise.reject(new Error('')),
})
function editPlace(title: string, name: string, description: string | null, save: (name: string, description: string | null) => Promise<Site>): void {
  place.value = { open: true, title, name, description: description ?? '', save }
}
async function savePlace(): Promise<void> {
  if (!place.value.name.trim()) return
  if (await run(() => place.value.save(place.value.name.trim(), place.value.description.trim() || null))) place.value.open = false
}

// --- Systèmes installés
const systemDialog = ref<{ open: boolean; system: InstalledSystem | null; system_id: number | null; building_id: number | null; name: string; description: string }>({
  open: false, system: null, system_id: null, building_id: null, name: '', description: '',
})
async function openSystem(s: InstalledSystem | null): Promise<void> {
  if (!catalog.value.length) catalog.value = await api.sites.catalog().catch(() => [])
  systemDialog.value = { open: true, system: s, system_id: s?.system_id ?? null, building_id: s?.building_id ?? null, name: s?.name ?? '', description: s?.description ?? '' }
}
function onCatalog(): void {
  const c = catalog.value.find((x) => x.id === systemDialog.value.system_id)
  if (c && !systemDialog.value.name.trim()) systemDialog.value.name = c.name
}
async function saveSystem(): Promise<void> {
  const d = systemDialog.value
  const payload = { system_id: d.system_id, building_id: d.building_id, name: d.name.trim() || null, description: d.description.trim() || null }
  const ok = await run(() => (d.system ? api.sites.updateSystem(d.system.id, payload) : api.sites.addSystem(props.projectId, payload)))
  if (ok) systemDialog.value.open = false
}

// --- Avancement
const progress = ref({ open: false, system: null as InstalledSystem | null, percent: 0, date: new Date() as Date | null, note: '' })
function openProgress(s: InstalledSystem): void {
  progress.value = { open: true, system: s, percent: s.progress, date: new Date(), note: '' }
}
async function saveProgress(): Promise<void> {
  const p = progress.value
  if (!p.system) return
  const ok = await run(() => api.sites.addProgress(p.system!.id, { percent: p.percent, date: toApiDate(p.date) ?? undefined, note: p.note.trim() || null, client_uuid: crypto.randomUUID() }))
  if (ok) progress.value.open = false
}

// --- Équipements
const equipmentOpen = ref(false)
const editing = ref<{ system: InstalledSystem | null; equipment: Equipment | null; parentId: number | null }>({ system: null, equipment: null, parentId: null })
function openEquipment(system: InstalledSystem, equipment: Equipment | null = null, parentId: number | null = null): void {
  editing.value = { system, equipment, parentId }
  equipmentOpen.value = true
}
const detail = ref<Equipment | null>(null)

// --- Catalogue des systèmes
const catalogOpen = ref(false)
const newCatalog = ref('')
async function openCatalog(): Promise<void> {
  catalog.value = await api.sites.catalog().catch(() => [])
  catalogOpen.value = true
}
async function addCatalog(): Promise<void> {
  if (!newCatalog.value.trim()) return
  try {
    catalog.value = [...catalog.value, await api.sites.addCatalogSystem({ name: newCatalog.value.trim() })].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    newCatalog.value = ''
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ajout impossible', detail: errorDetail(e), life: 5000 })
  }
}
async function removeCatalog(id: number): Promise<void> {
  await api.sites.removeCatalogSystem(id)
  catalog.value = catalog.value.filter((c) => c.id !== id)
}
</script>

<template>
  <div v-if="loading && !site" class="center"><ProgressSpinner /></div>
  <p v-else-if="!site" class="muted">Le chantier n'a pas pu être chargé.</p>
  <div v-else class="site">
    <div class="summary">
      <div class="big">
        <span class="muted">Avancement global</span>
        <strong>{{ site!.progress }} %</strong>
        <ProgressBar :value="site!.progress" :show-value="false" class="bar" :pt="{ value: { style: { background: progressColor(site!.progress) } } }" />
      </div>
      <div><span class="muted">Systèmes</span><strong>{{ site!.systems.length }}</strong></div>
      <div><span class="muted">Équipements</span><strong>{{ site!.equipment_count }}</strong></div>
      <div><span class="muted">Bâtiments</span><strong>{{ site!.buildings.length }}</strong></div>
      <span class="grow" />
      <Button label="DOE (PDF)" icon="pi pi-book" text size="small" :loading="doeLoading" @click="openDoe" />
      <Button v-if="auth.can('sites.create')" label="Catalogue des systèmes" icon="pi pi-list" text size="small" @click="openCatalog" />
    </div>

    <SelectButton v-model="view" :options="views" option-label="label" option-value="value" :allow-empty="false" />
    <PlansPanel v-if="view === 'plans'" :site="site!" />
    <QuantitiesPanel v-else-if="view === 'quantities'" :site="site!" />
    <SheetsPanel v-else-if="view === 'sheets'" :site="site!" />

    <div v-show="view === 'installation'" class="layout">
      <!-- Bâtiments -->
      <Card class="places">
        <template #title>Bâtiments</template>
        <template #content>
          <p v-if="!site!.buildings.length" class="muted">Aucun bâtiment.</p>
          <ul class="tree">
            <li v-for="b in site!.buildings" :key="b.id">
              <div class="node">
                <i class="pi pi-building muted" /><strong class="grow">{{ b.name }}</strong>
                <template v-if="can.manage">
                  <Button v-if="can.create" icon="pi pi-plus" text rounded size="small" aria-label="Ajouter un niveau" title="Ajouter un niveau" @click="editPlace(`Nouveau niveau — ${b.name}`, '', null, (n, d) => api.sites.addLevel(b.id, { name: n, description: d }))" />
                  <Button icon="pi pi-pencil" text rounded size="small" aria-label="Renommer" @click="editPlace('Bâtiment', b.name, b.description, (n, d) => api.sites.updateBuilding(b.id, { name: n, description: d }))" />
                  <Button v-if="can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="confirmDelete(`le bâtiment « ${b.name} »`, () => api.sites.removeBuilding(b.id))" />
                </template>
              </div>
              <ul>
                <li v-for="l in b.levels" :key="l.id">
                  <div class="node">
                    <i class="pi pi-bars muted" /><span class="grow">{{ l.name }}</span>
                    <template v-if="can.manage">
                      <Button v-if="can.create" icon="pi pi-plus" text rounded size="small" aria-label="Ajouter une pièce" title="Ajouter une pièce" @click="editPlace(`Nouvelle pièce — ${l.name}`, '', null, (n, d) => api.sites.addRoom(l.id, { name: n, description: d }))" />
                      <Button icon="pi pi-pencil" text rounded size="small" aria-label="Renommer" @click="editPlace('Niveau', l.name, l.description, (n, d) => api.sites.updateLevel(l.id, { name: n, description: d }))" />
                      <Button v-if="can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="confirmDelete(`le niveau « ${l.name} » et ses pièces`, () => api.sites.removeLevel(l.id))" />
                    </template>
                  </div>
                  <ul>
                    <li v-for="r in l.rooms" :key="r.id" class="node room">
                      <span class="grow">{{ r.name }}</span>
                      <template v-if="can.manage">
                        <Button icon="pi pi-pencil" text rounded size="small" aria-label="Renommer" @click="editPlace('Pièce', r.name, r.description, (n, d) => api.sites.updateRoom(r.id, { name: n, description: d }))" />
                        <Button v-if="can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="confirmDelete(`la pièce « ${r.name} »`, () => api.sites.removeRoom(r.id))" />
                      </template>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
          <Button v-if="can.create" label="Ajouter un bâtiment" icon="pi pi-plus" text size="small" @click="editPlace('Nouveau bâtiment', '', null, (n, d) => api.sites.addBuilding(props.projectId, { name: n, description: d }))" />
        </template>
      </Card>

      <!-- Systèmes installés -->
      <div class="systems">
        <div class="systems-head">
          <h3>Systèmes installés</h3>
          <Button v-if="canFromQuote" label="Depuis un devis" icon="pi pi-file-import" size="small" severity="secondary" outlined @click="fromQuoteOpen = true" />
          <Button v-if="can.create" label="Ajouter un système" icon="pi pi-plus" size="small" @click="openSystem(null)" />
        </div>
        <QuoteSiteDialog v-if="canFromQuote" v-model:visible="fromQuoteOpen" :project-id="props.projectId" @done="set" />
        <p v-if="!site!.systems.length" class="muted">Aucun système. Ajoutez la vidéosurveillance, l'alarme, la détection incendie… puis leurs équipements.</p>
        <Card v-for="s in site!.systems" :key="s.id" class="system">
          <template #content>
            <div class="system-head">
              <button type="button" class="toggle" :aria-expanded="!!openSystems[s.id]" @click="openSystems[s.id] = !openSystems[s.id]">
                <i :class="openSystems[s.id] ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
                <i v-if="s.system?.icon" :class="`pi ${s.system.icon}`" />
                <strong>{{ s.name }}</strong>
                <span v-if="buildingName(s.building_id)" class="muted small">· {{ buildingName(s.building_id) }}</span>
              </button>
              <div class="progress">
                <ProgressBar :value="s.progress" :show-value="false" class="bar" :pt="{ value: { style: { background: progressColor(s.progress) } } }" />
                <span class="small">{{ s.progress }} %</span>
              </div>
              <Button v-if="can.manage" label="Avancement" icon="pi pi-chart-line" text size="small" @click="openProgress(s)" />
              <Button v-if="can.manage" icon="pi pi-pencil" text rounded size="small" aria-label="Modifier le système" @click="openSystem(s)" />
              <Button v-if="can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer le système" @click="confirmDelete(`le système « ${s.name} » et ses équipements`, () => api.sites.removeSystem(s.id))" />
            </div>
            <p v-if="!openSystems[s.id]" class="muted small totals">
              <template v-for="(t, i) in equipmentTotals(s.equipment ?? [])" :key="t.label">{{ i ? ' · ' : '' }}{{ t.quantity }} × {{ t.label }}</template>
              <template v-if="!(s.equipment ?? []).length">Aucun équipement</template>
            </p>
            <template v-else>
              <MarkdownView class="small" :text="s.description" />
              <table v-if="(s.equipment ?? []).length" class="list equipment">
                <thead><tr><th>Équipement</th><th>Qté</th><th>Emplacement</th><th>Caractéristiques</th><th>État</th><th /></tr></thead>
                <tbody>
                  <template v-for="node in equipmentTree(s.equipment ?? [])" :key="node.item.id">
                    <tr v-for="e in [node.item, ...node.children]" :key="e.id" :class="{ child: e.parent_id }">
                      <td>
                        <button type="button" class="link" @click="detail = e"><i v-if="e.parent_id" class="pi pi-angle-right muted" /> {{ e.name }}</button>
                        <div class="muted small">{{ [e.type, e.model, e.serial_number ? `N° ${e.serial_number}` : null].filter(Boolean).join(' · ') }}</div>
                      </td>
                      <td>{{ e.quantity }}</td>
                      <td class="small">{{ placeLabel(site!, e.level_id, e.room_id) ?? '—' }}</td>
                      <td class="small"><div v-for="c in e.characteristics.slice(0, 3)" :key="c.label"><span class="muted">{{ c.label }} :</span> {{ c.value }}</div></td>
                      <td><Tag :value="e.status.label" :severity="equipmentStatusSeverity(e.status.value)" /></td>
                      <td class="actions">
                        <template v-if="can.manage">
                          <Button v-if="!e.parent_id" icon="pi pi-plus" text rounded size="small" aria-label="Ajouter un sous-équipement" title="Ajouter un sous-équipement" @click="openEquipment(s, null, e.id)" />
                          <Button v-if="e.quantity > 1" icon="pi pi-clone" text rounded size="small" aria-label="Éclater le groupe" :title="`Éclater en ${e.quantity} appareils identiques`" @click="confirmSplit(e)" />
                          <Button icon="pi pi-pencil" text rounded size="small" aria-label="Modifier" @click="openEquipment(s, e)" />
                          <Button v-if="can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="confirmDelete(`« ${e.name} »`, () => api.sites.removeEquipment(e.id))" />
                        </template>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
              <p v-else class="muted small">Aucun équipement.</p>
              <div class="system-foot">
                <Button v-if="can.manage" label="Ajouter un équipement" icon="pi pi-plus" text size="small" @click="openEquipment(s)" />
                <span class="grow" />
                <span v-if="s.progress_entries?.length" class="muted small">
                  Dernier relevé : {{ formatDate(s.progress_entries?.[0]?.date ?? null) }}<template v-if="s.progress_entries?.[0]?.note"> — {{ markdownToText(s.progress_entries?.[0]?.note) }}</template>
                </span>
              </div>
            </template>
          </template>
        </Card>
      </div>
    </div>

    <!-- Fenêtres -->
    <Dialog v-model:visible="place.open" :header="place.title" modal :style="{ width: '420px' }">
      <form id="place-form" class="form-grid" @submit.prevent="savePlace">
        <div class="form-field form-field--full"><label for="pl-name">Nom</label><InputText id="pl-name" v-model="place.name" autofocus /></div>
        <div class="form-field form-field--full"><label for="pl-desc">Description</label><MarkdownEditor id="pl-desc" v-model="place.description" rows="2" auto-resize /></div>
      </form>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="place.open = false" />
        <Button label="Enregistrer" type="submit" form="place-form" :disabled="!place.name.trim()" />
      </template>
    </Dialog>

    <Dialog v-model:visible="systemDialog.open" :header="systemDialog.system ? 'Modifier le système' : 'Ajouter un système'" modal :style="{ width: '480px' }">
      <form id="system-form" class="form-grid" @submit.prevent="saveSystem">
        <div class="form-field form-field--full">
          <label for="sys-cat">Type de système</label>
          <Select id="sys-cat" v-model="systemDialog.system_id" :options="[{ id: null, name: 'Autre' }, ...catalog]" option-label="name" option-value="id" filter @change="onCatalog" />
        </div>
        <div class="form-field form-field--full"><label for="sys-name">Nom</label><InputText id="sys-name" v-model="systemDialog.name" placeholder="Vidéosurveillance bâtiment A…" /></div>
        <div v-if="site!.buildings.length" class="form-field form-field--full">
          <label for="sys-building">Bâtiment</label>
          <Select id="sys-building" v-model="systemDialog.building_id" :options="[{ id: null, name: 'Tout le projet' }, ...site!.buildings]" option-label="name" option-value="id" />
        </div>
        <div class="form-field form-field--full"><label for="sys-desc">Description</label><MarkdownEditor id="sys-desc" v-model="systemDialog.description" rows="2" auto-resize /></div>
      </form>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="systemDialog.open = false" />
        <Button label="Enregistrer" type="submit" form="system-form" :disabled="!systemDialog.name.trim() && !systemDialog.system_id" />
      </template>
    </Dialog>

    <Dialog v-model:visible="progress.open" :header="`Avancement — ${progress.system?.name ?? ''}`" modal :style="{ width: '480px' }">
      <form id="progress-form" class="form-grid" @submit.prevent="saveProgress">
        <div class="form-field"><label for="pr-percent">Avancement (%)</label><InputNumber v-model="progress.percent" input-id="pr-percent" :min="0" :max="100" suffix=" %" show-buttons :step="5" /></div>
        <div class="form-field"><label for="pr-date">Date</label><DatePicker v-model="progress.date" input-id="pr-date" date-format="dd/mm/yy" :max-date="new Date()" /></div>
        <div class="form-field form-field--full"><label for="pr-note">Note</label><MarkdownEditor id="pr-note" v-model="progress.note" rows="2" auto-resize placeholder="Câblage terminé, reste la mise en service…" /></div>
      </form>
      <ul v-if="progress.system?.progress_entries?.length" class="history">
        <li v-for="p in progress.system?.progress_entries ?? []" :key="p.id">
          <strong>{{ p.percent }} %</strong> <span class="muted small">{{ formatDate(p.date) }} · {{ p.creator?.full_name ?? '—' }}</span>
          <span v-if="p.note" class="small"> — {{ markdownToText(p.note) }}</span>
          <Button v-if="can.manage" icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Retirer le relevé" @click="run(() => api.sites.removeProgress(p.id)).then((ok) => ok && (progress.system = site?.systems.find((x) => x.id === progress.system?.id) ?? null))" />
        </li>
      </ul>
      <template #footer>
        <Button label="Fermer" text severity="secondary" @click="progress.open = false" />
        <Button label="Enregistrer le relevé" type="submit" form="progress-form" />
      </template>
    </Dialog>

    <Dialog :visible="!!detail" :header="detail?.name" modal :style="{ width: '620px' }" :breakpoints="{ '660px': '95vw' }" @update:visible="(v: boolean) => !v && (detail = null)">
      <template v-if="detail">
        <dl class="facts">
          <dt>Type</dt><dd>{{ detail.type ?? '—' }}</dd>
          <dt>Modèle</dt><dd>{{ detail.model ?? '—' }}</dd>
          <dt>N° de série</dt><dd>{{ detail.serial_number ?? '—' }}</dd>
          <dt>Quantité</dt><dd>{{ detail.quantity }}</dd>
          <dt>État</dt><dd><Tag :value="detail.status.label" :severity="equipmentStatusSeverity(detail.status.value)" /></dd>
          <dt>Emplacement</dt><dd>{{ placeLabel(site!, detail.level_id, detail.room_id) ?? '—' }}</dd>
          <template v-if="detail.article"><dt>Article</dt><dd>{{ detail.article.designation }}<span v-if="detail.article.reference" class="muted"> · {{ detail.article.reference }}</span></dd></template>
          <template v-for="c in detail.characteristics" :key="c.label"><dt>{{ c.label }}</dt><dd class="mono">{{ c.value }}</dd></template>
        </dl>
        <MarkdownView :text="detail.description" />
        <h4>Photos et documents</h4>
        <AttachmentsPanel kind="documents" type="equipment" :id="detail.id" :can-add="can.manage" :can-manage="can.delete" />
      </template>
    </Dialog>

    <Dialog v-model:visible="catalogOpen" header="Catalogue des systèmes" modal :style="{ width: '440px' }">
      <ul class="catalog">
        <li v-for="c in catalog" :key="c.id">
          <i v-if="c.icon" :class="`pi ${c.icon}`" /> <span class="grow">{{ c.name }}</span>
          <Button v-if="auth.can('sites.delete')" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Retirer" @click="removeCatalog(c.id)" />
        </li>
      </ul>
      <form class="row" @submit.prevent="addCatalog">
        <InputText v-model="newCatalog" placeholder="Nouveau système" class="grow" />
        <Button type="submit" icon="pi pi-plus" aria-label="Ajouter" :disabled="!newCatalog.trim()" />
      </form>
    </Dialog>

    <EquipmentDialog v-model:visible="equipmentOpen" :site="site!" :system="editing.system" :equipment="editing.equipment" :parent-id="editing.parentId" @saved="set" />
  </div>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.site {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-end;
}

.summary > div {
  display: flex;
  flex-direction: column;
}

.summary strong {
  font-size: 1.25rem;
}

.summary .big {
  min-width: 220px;
}

.bar {
  height: 0.5rem;
}

.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.tree,
.tree ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree ul {
  padding-left: 1rem;
}

.node {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
}

.room {
  padding-left: 0.5rem;
  font-size: 0.9rem;
}

.systems {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.systems-head,
.system-head,
.system-foot,
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.systems-head h3 {
  margin: 0;
  flex: 1;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
}

.progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 160px;
}

.progress .bar {
  flex: 1;
}

.equipment {
  margin-top: 0.5rem;
}

.equipment tr.child td:first-child {
  padding-left: 1.5rem;
}

.equipment .actions {
  white-space: nowrap;
  text-align: right;
}

.totals {
  margin: 0.375rem 0 0;
}

.history,
.catalog {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.catalog li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.375rem 1rem;
}

.facts dt {
  color: var(--p-text-muted-color);
}

.facts dd {
  margin: 0;
}

.mono {
  font-family: ui-monospace, monospace;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.85rem;
}

.pre {
  white-space: pre-wrap;
}

.link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
</style>
