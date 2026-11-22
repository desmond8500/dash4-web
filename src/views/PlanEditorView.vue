<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import ContextMenu from 'primevue/contextmenu'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { MenuItem } from 'primevue/menuitem'
import {
  ApiError,
  angleFrom,
  clampPosition,
  clampSize,
  layerKey,
  markerColor,
  normalizeAngle,
  planLayers,
  planLegend,
  visibleMarkers,
} from '@dash4/shared'
import type { Equipment, Plan, PlanIcon, PlanMarker, PlanMarkerPayload, Site } from '@dash4/shared'
import { api } from '@/services/api'
import { usePlanIconsStore } from '@/stores/planIcons'
import { matchesSearch } from '@/utils/listSearch'
import { renderPlan } from '@/utils/planRender'
import PlanIconGlyph from '@/components/plans/PlanIconGlyph.vue'

/**
 * Éditeur de plans d'un chantier : repères d'équipements avec icônes (taille, rotation, couleur),
 * déplacement à la souris, menu contextuel, calques par système, légende. Après chaque changement,
 * un aperçu de la page est envoyé au serveur : c'est lui qui va dans le DOE et le PDF du plan.
 */
const props = defineProps<{ projectId: string; planId?: string }>()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const iconsStore = usePlanIconsStore()

const COLORS = ['#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#111827']

const site = ref<Site | null>(null)
const plans = ref<Plan[]>([])
const current = ref<Plan | null>(null)
const page = ref(1)
const base = ref<{ url: string; img: HTMLImageElement; pages: number } | null>(null)
const loadingImage = ref(false)
const zoom = ref(1)
const selectedId = ref<number | null>(null)
const stage = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const paletteTab = ref('equipment')
const paletteSearch = ref('')
const newLayer = ref<number | null>(null)
const lastSize = ref(0.03)
/** Outil de pose : équipement, icône de la bibliothèque ou repère libre. */
type Tool = { kind: 'equipment'; equipment: Equipment & { system: string } } | { kind: 'icon'; icon: PlanIcon } | { kind: 'free' }
const tool = ref<Tool | null>(null)

const canEdit = computed(() => !!site.value?.can.manage)
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

// --- Données ------------------------------------------------------------------------------
const systems = computed(() => site.value?.systems ?? [])
const equipment = computed(() => systems.value.flatMap((s) => (s.equipment ?? []).map((e) => ({ ...e, system: s.name }))))
const equipmentById = computed(() => new Map(equipment.value.map((e) => [e.id, e])))
const equipmentName = (id: number | null) => (id ? (equipmentById.value.get(id)?.name ?? null) : null)
const placedIds = computed(() => new Set(plans.value.flatMap((p) => (p.markers ?? []).map((m) => m.equipment_id)).filter(Boolean)))
const iconById = computed(() => new Map(iconsStore.icons.map((i) => [i.id, i])))
const iconOf = (m: Pick<PlanMarker, 'icon_id'>) => (m.icon_id ? (iconById.value.get(m.icon_id) ?? null) : null)

const markers = computed(() => current.value?.markers ?? [])
const pageMarkers = computed(() => markers.value.filter((m) => m.page === page.value))
const hidden = computed(() => current.value?.settings.hidden_layers ?? [])
const shownMarkers = computed(() => visibleMarkers(pageMarkers.value, hidden.value))
const layers = computed(() => planLayers(markers.value, systems.value, hidden.value))
const selected = computed(() => markers.value.find((m) => m.id === selectedId.value) ?? null)
const legend = computed(() => planLegend(shownMarkers.value, iconsStore.icons, equipmentName))
const labelOf = (m: PlanMarker) => (current.value?.settings.labels !== false && m.show_label ? (m.label ?? equipmentName(m.equipment_id)) : null)

const paletteEquipment = computed(() =>
  equipment.value
    .filter((e) => matchesSearch(paletteSearch.value, e.name, e.system, e.model, e.article?.designation))
    .sort((a, b) => Number(placedIds.value.has(a.id)) - Number(placedIds.value.has(b.id)) || a.system.localeCompare(b.system, 'fr') || a.name.localeCompare(b.name, 'fr', { numeric: true })),
)
const paletteIcons = computed(() => {
  const groups = new Map<string, PlanIcon[]>()
  for (const icon of iconsStore.icons.filter((i) => matchesSearch(paletteSearch.value, i.name, i.category))) {
    const key = icon.category || 'Sans catégorie'
    groups.set(key, [...(groups.get(key) ?? []), icon])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
})
const layerOptions = computed(() => [{ id: null as number | null, name: 'Sans système' }, ...systems.value.map((s) => ({ id: s.id as number | null, name: s.name }))])

// --- Chargement ---------------------------------------------------------------------------
async function load(): Promise<void> {
  const projectId = Number(props.projectId)
  const [s, p] = await Promise.all([api.sites.get(projectId), api.plans.list(projectId), iconsStore.load()])
  site.value = s
  plans.value = p
  const wanted = plans.value.find((x) => x.id === Number(props.planId)) ?? plans.value[0]
  if (wanted) await open(wanted)
}
onMounted(() => {
  void load().catch((e) => toast.add({ severity: 'error', summary: 'Plans indisponibles', detail: errorDetail(e), life: 6000 }))
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (renderTimer) {
    clearTimeout(renderTimer)
    void doRender()
  }
  release()
})

function release(): void {
  if (base.value) URL.revokeObjectURL(base.value.url)
  base.value = null
}

async function open(plan: Plan, pageNumber = 1): Promise<void> {
  if (renderTimer) {
    clearTimeout(renderTimer)
    await doRender()
  }
  const same = current.value?.id === plan.id
  current.value = plan
  selectedId.value = null
  tool.value = null
  if (!same) void router.replace({ name: 'plan-editor', params: { projectId: props.projectId, planId: plan.id } })
  if (same && page.value === pageNumber && base.value) return
  page.value = pageNumber
  loadingImage.value = true
  release()
  try {
    const blob = await api.plans.file(plan)
    let url: string
    let pages = 1
    if (plan.kind === 'pdf') {
      const { pdfPageImage } = await import('@/utils/pdf')
      const result = await pdfPageImage(await blob.arrayBuffer(), pageNumber)
      url = result.url
      pages = result.pages
    } else {
      url = URL.createObjectURL(blob)
    }
    const img = new Image()
    img.src = url
    await img.decode()
    base.value = { url, img, pages }
    // Aperçu absent ou plus ancien que le plan : on le refait
    const render = plan.renders.find((r) => r.page === pageNumber)
    if (canEdit.value && (!render || (plan.updated_at && render.updated_at && render.updated_at < plan.updated_at))) scheduleRender(500)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Plan illisible', detail: errorDetail(e), life: 5000 })
  } finally {
    loadingImage.value = false
  }
}

function replacePlan(plan: Plan): void {
  plans.value = plans.value.map((p) => (p.id === plan.id ? plan : p))
  if (current.value?.id === plan.id) current.value = plan
}

async function onUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    const plan = await api.plans.upload(Number(props.projectId), file, file.name)
    plans.value = [...plans.value, plan]
    await open(plan)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Plan refusé', detail: errorDetail(e), life: 6000 })
  } finally {
    uploading.value = false
  }
}

function renamePlan(): void {
  const plan = current.value
  if (!plan) return
  const name = window.prompt('Nom du plan', plan.name)?.trim()
  if (name && name !== plan.name) void api.plans.update(plan.id, { name }).then(replacePlan)
}

function removePlan(): void {
  const plan = current.value
  if (!plan) return
  confirm.require({
    header: 'Supprimer le plan',
    message: `Supprimer « ${plan.name} » et ses ${plan.markers?.length ?? 0} repère(s) ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.plans.remove(plan.id)
      plans.value = plans.value.filter((p) => p.id !== plan.id)
      current.value = null
      release()
      if (plans.value[0]) await open(plans.value[0])
    },
  })
}

// --- Aperçu pour les PDF ------------------------------------------------------------------
const renderState = ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
let renderTimer: ReturnType<typeof setTimeout> | undefined
function scheduleRender(delay = 2500): void {
  if (!canEdit.value) return
  renderState.value = 'pending'
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => void doRender(), delay)
}
async function doRender(): Promise<void> {
  renderTimer = undefined
  const plan = current.value
  if (!plan || !base.value || !canEdit.value) return
  renderState.value = 'saving'
  try {
    const result = await renderPlan({
      base: base.value.img,
      markers: shownMarkers.value,
      icons: iconById.value,
      images: iconsStore.images,
      legend: plan.settings.legend ? legend.value : null,
      labelOf,
      title: plan.name,
    })
    const updated = await api.plans.uploadRender(plan.id, page.value, result.blob, result)
    // Ne garder que les aperçus : les repères ont pu changer pendant l'envoi
    const keep = plans.value.find((p) => p.id === plan.id)
    if (keep) replacePlan({ ...keep, renders: updated.renders })
    renderState.value = 'saved'
  } catch {
    renderState.value = 'error'
  }
}

async function openPdf(): Promise<void> {
  if (!current.value) return
  if (renderTimer) {
    clearTimeout(renderTimer)
    await doRender()
  }
  const url = URL.createObjectURL(await api.plans.pdf(current.value.id))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// --- Repères : création, modification ----------------------------------------------------
async function saveMarker(m: PlanMarker, payload: PlanMarkerPayload): Promise<void> {
  Object.assign(m, payload)
  try {
    replacePlan(await api.plans.updateMarker(m.id, payload))
    scheduleRender()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Repère non enregistré', detail: errorDetail(e), life: 5000 })
    if (current.value) replacePlan({ ...current.value, markers: (await api.plans.list(Number(props.projectId))).find((p) => p.id === current.value!.id)?.markers ?? [] })
  }
}

async function createMarker(payload: PlanMarkerPayload & { x: number; y: number }): Promise<void> {
  if (!current.value) return
  const uuid = crypto.randomUUID()
  try {
    const plan = await api.plans.addMarker(current.value.id, { page: page.value, size: lastSize.value, ...payload, client_uuid: uuid })
    replacePlan(plan)
    selectedId.value = plan.markers?.find((m) => m.client_uuid === uuid)?.id ?? null
    scheduleRender()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Repère refusé', detail: errorDetail(e), life: 5000 })
  }
}

function toolPayload(t: Tool): PlanMarkerPayload {
  if (t.kind === 'equipment') return { equipment_id: t.equipment.id }
  if (t.kind === 'icon') return { plan_icon_id: t.icon.id, installed_system_id: newLayer.value, color: t.icon.color }
  return { installed_system_id: newLayer.value }
}

async function placeAt(x: number, y: number, t: Tool): Promise<void> {
  await createMarker({ x: clampPosition(x), y: clampPosition(y), ...toolPayload(t) })
  // Un équipement se place une fois ; une icône se pose autant de fois qu'on veut
  if (t.kind === 'equipment') tool.value = null
}

function duplicate(m: PlanMarker): void {
  void createMarker({
    x: clampPosition(m.x + 0.02), y: clampPosition(m.y + 0.02), size: m.size, rotation: m.rotation, color: m.color, plan_icon_id: m.plan_icon_id,
    installed_system_id: m.installed_system_id ?? m.layer_id, label: m.label, show_label: m.show_label,
  })
}

function removeMarker(m: PlanMarker): void {
  if (current.value) current.value = { ...current.value, markers: markers.value.filter((x) => x.id !== m.id) }
  selectedId.value = null
  void api.plans.removeMarker(m.id).then((plan) => {
    replacePlan(plan)
    scheduleRender()
  })
}

// --- Souris : poser, déplacer, redimensionner, pivoter ------------------------------------
function relative(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const rect = stage.value!.getBoundingClientRect()
  return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
}

function onStagePointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  if (tool.value && canEdit.value) {
    const { x, y } = relative(e)
    void placeAt(x, y, tool.value)
    return
  }
  selectedId.value = null
}

type Drag = { kind: 'move' | 'resize' | 'rotate'; marker: PlanMarker; startX: number; startY: number; origin: { x: number; y: number; size: number; rotation: number }; moved: boolean }
let drag: Drag | null = null

function startDrag(e: PointerEvent, m: PlanMarker, kind: Drag['kind']): void {
  if (e.button !== 0) return
  selectedId.value = m.id
  if (!canEdit.value) return
  drag = { kind, marker: m, startX: e.clientX, startY: e.clientY, origin: { x: m.x, y: m.y, size: m.size, rotation: m.rotation }, moved: false }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
}

function onDragMove(e: PointerEvent): void {
  if (!drag || !stage.value) return
  const rect = stage.value.getBoundingClientRect()
  const m = drag.marker
  if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 3) drag.moved = true
  if (!drag.moved) return
  const cx = rect.left + drag.origin.x * rect.width
  const cy = rect.top + drag.origin.y * rect.height
  if (drag.kind === 'move') {
    m.x = clampPosition(drag.origin.x + (e.clientX - drag.startX) / rect.width)
    m.y = clampPosition(drag.origin.y + (e.clientY - drag.startY) / rect.height)
  } else if (drag.kind === 'resize') {
    const half = Math.max(Math.abs(e.clientX - cx), Math.abs(e.clientY - cy))
    m.size = clampSize((half * 2) / rect.width)
  } else {
    m.rotation = angleFrom(cx, cy, e.clientX, e.clientY, e.shiftKey ? 1 : 15)
  }
}

function onDragEnd(): void {
  window.removeEventListener('pointermove', onDragMove)
  const d = drag
  drag = null
  if (!d || !d.moved) return
  const m = d.marker
  if (d.kind === 'move') void saveMarker(m, { x: m.x, y: m.y })
  else if (d.kind === 'resize') {
    lastSize.value = m.size
    void saveMarker(m, { size: m.size })
  } else void saveMarker(m, { rotation: m.rotation })
}

// Glisser un équipement ou une icône de la palette sur le plan
function onPaletteDragStart(e: DragEvent, t: Tool): void {
  tool.value = null
  dragTool = t
  e.dataTransfer?.setData('text/plain', 'dash4-plan')
}
let dragTool: Tool | null = null
function onDrop(e: DragEvent): void {
  if (!dragTool || !canEdit.value) return
  const { x, y } = relative(e)
  void placeAt(x, y, dragTool)
  dragTool = null
}

function onWheel(e: WheelEvent): void {
  if (!e.ctrlKey) return
  e.preventDefault()
  setZoom(zoom.value * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
}
function setZoom(z: number): void {
  zoom.value = Math.min(6, Math.max(0.25, Math.round(z * 100) / 100))
}

// --- Clavier ------------------------------------------------------------------------------
function onKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null
  if (target && (target.closest('input, textarea, [contenteditable="true"], .p-dialog') || target.isContentEditable)) return
  if (e.key === 'Escape') {
    tool.value = null
    selectedId.value = null
    return
  }
  const m = selected.value
  if (!m || !canEdit.value) return
  const step = e.shiftKey ? 0.01 : 0.002
  const nudges: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  if (nudges[e.key]) {
    e.preventDefault()
    const [dx, dy] = nudges[e.key]!
    m.x = clampPosition(m.x + dx)
    m.y = clampPosition(m.y + dy)
    queueSave(m, () => ({ x: m.x, y: m.y }))
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    removeMarker(m)
  } else if (e.key.toLowerCase() === 'r') {
    m.rotation = normalizeAngle(m.rotation + (e.shiftKey ? -15 : 15))
    queueSave(m, () => ({ rotation: m.rotation }))
  } else if (e.key === '+' || e.key === '=') {
    m.size = clampSize(m.size * 1.15)
    queueSave(m, () => ({ size: m.size }))
  } else if (e.key === '-') {
    m.size = clampSize(m.size / 1.15)
    queueSave(m, () => ({ size: m.size }))
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
    e.preventDefault()
    duplicate(m)
  }
}
let saveTimer: ReturnType<typeof setTimeout> | undefined
function queueSave(m: PlanMarker, payload: () => PlanMarkerPayload): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveMarker(m, payload()), 400)
}

// --- Menu contextuel ----------------------------------------------------------------------
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
const menuTarget = ref<PlanMarker | null>(null)
const menuPoint = ref<{ x: number; y: number } | null>(null)
const menuItems = computed<MenuItem[]>(() => {
  const m = menuTarget.value
  if (!canEdit.value) return m ? [{ label: 'Sélectionner', icon: 'pi pi-check', command: () => (selectedId.value = m.id) }] : []
  if (!m) {
    const p = menuPoint.value
    return [
      { label: 'Poser un repère libre ici', icon: 'pi pi-map-marker', command: () => p && void placeAt(p.x, p.y, { kind: 'free' }) },
      ...(tool.value ? [{ label: 'Arrêter la pose', icon: 'pi pi-times', command: () => (tool.value = null) }] : []),
    ]
  }
  return [
    { label: 'Dupliquer', icon: 'pi pi-copy', command: () => duplicate(m) },
    { label: 'Pivoter de 90°', icon: 'pi pi-replay', command: () => void saveMarker(m, { rotation: normalizeAngle(m.rotation + 90) }) },
    { label: 'Remettre droit', icon: 'pi pi-arrow-up', disabled: m.rotation === 0, command: () => void saveMarker(m, { rotation: 0 }) },
    { label: 'Agrandir', icon: 'pi pi-plus', command: () => void saveMarker(m, { size: clampSize(m.size * 1.25) }) },
    { label: 'Réduire', icon: 'pi pi-minus', command: () => void saveMarker(m, { size: clampSize(m.size / 1.25) }) },
    {
      label: 'Couleur',
      icon: 'pi pi-palette',
      items: [
        { label: "Couleur de l'icône", command: () => void saveMarker(m, { color: null }) },
        ...COLORS.map((c) => ({ label: c, icon: 'pi pi-circle-fill', style: { color: c }, command: () => void saveMarker(m, { color: c }) })),
      ],
    },
    { label: "Changer d'icône…", icon: 'pi pi-th-large', command: () => openIconPicker(m) },
    { label: m.show_label ? 'Masquer le nom' : 'Afficher le nom', icon: 'pi pi-tag', command: () => void saveMarker(m, { show_label: !m.show_label }) },
    {
      label: 'Calque',
      icon: 'pi pi-clone',
      items: layerOptions.value.map((l) => ({
        label: l.name,
        icon: (m.installed_system_id ?? m.layer_id) === l.id ? 'pi pi-check' : undefined,
        command: () => void saveMarker(m, { installed_system_id: l.id }),
      })),
    },
    { separator: true },
    { label: 'Supprimer', icon: 'pi pi-trash', class: 'danger', command: () => removeMarker(m) },
  ]
})
function openMenu(e: MouseEvent, m: PlanMarker | null): void {
  menuTarget.value = m
  menuPoint.value = m ? null : relative(e)
  if (m) selectedId.value = m.id
  void nextTick(() => menu.value?.show(e))
}

// --- Icônes -------------------------------------------------------------------------------
const pickerFor = ref<PlanMarker | null>(null)
function openIconPicker(m: PlanMarker): void {
  pickerFor.value = m
}
function pickIcon(icon: PlanIcon | null): void {
  const m = pickerFor.value
  pickerFor.value = null
  if (m) void saveMarker(m, { plan_icon_id: icon?.id ?? null, ...(icon?.color ? { color: null } : {}) })
}

// --- Calques et affichage -----------------------------------------------------------------
let settingsTimer: ReturnType<typeof setTimeout> | undefined
function updateSettings(change: Partial<Plan['settings']>): void {
  const plan = current.value
  if (!plan) return
  replacePlan({ ...plan, settings: { ...plan.settings, ...change } })
  scheduleRender()
  if (!canEdit.value) return
  clearTimeout(settingsTimer)
  settingsTimer = setTimeout(() => void api.plans.update(plan.id, { settings: current.value!.settings }).then((p) => replacePlan({ ...p, renders: current.value?.renders ?? p.renders })), 500)
}
function toggleLayer(key: string): void {
  const list = hidden.value.includes(key) ? hidden.value.filter((k) => k !== key) : [...hidden.value, key]
  updateSettings({ hidden_layers: list })
  if (selected.value && list.includes(layerKey(selected.value))) selectedId.value = null
}
function onlyLayer(key: string): void {
  updateSettings({ hidden_layers: layers.value.map((l) => l.key).filter((k) => k !== key) })
}

// --- Panneau de propriétés ----------------------------------------------------------------
const labelDraft = ref('')
watch(selected, (m) => (labelDraft.value = m?.label ?? ''), { immediate: true })
function saveLabel(): void {
  const m = selected.value
  if (m && (labelDraft.value.trim() || null) !== m.label) void saveMarker(m, { label: labelDraft.value.trim() || null })
}
const sizePercent = computed({
  get: () => Math.round((selected.value?.size ?? 0.03) * 1000) / 10,
  set: (v: number) => {
    if (selected.value) selected.value.size = clampSize(v / 100)
  },
})
function onSizeEnd(): void {
  const m = selected.value
  if (m) {
    lastSize.value = m.size
    void saveMarker(m, { size: m.size })
  }
}
const rotation = computed({
  get: () => selected.value?.rotation ?? 0,
  set: (v: number) => {
    if (selected.value) selected.value.rotation = normalizeAngle(v)
  },
})
const equipmentOptions = computed(() => [
  { id: null as number | null, label: 'Aucun (repère libre)' },
  ...equipment.value.map((e) => ({ id: e.id as number | null, label: `${placedIds.value.has(e.id) && e.id !== selected.value?.equipment_id ? '✓ ' : ''}${e.name} — ${e.system}` })),
])

const renderLabel = computed(() => ({ idle: '', pending: 'Aperçu PDF à mettre à jour…', saving: 'Mise à jour de l’aperçu PDF…', saved: 'Aperçu PDF à jour', error: "Aperçu PDF non envoyé" })[renderState.value])
</script>

<template>
  <div class="editor">
    <header class="bar">
      <Button icon="pi pi-arrow-left" text rounded aria-label="Retour au projet" @click="router.push({ name: 'project', params: { id: props.projectId }, query: { onglet: 'chantier' } })" />
      <div class="title">
        <strong>{{ current?.name ?? 'Plans' }}</strong>
        <span class="muted small">{{ site?.project.name }}</span>
      </div>
      <template v-if="current">
        <Button v-if="canEdit" icon="pi pi-pencil" text rounded size="small" aria-label="Renommer le plan" @click="renamePlan" />
        <template v-if="base && base.pages > 1">
          <Button icon="pi pi-chevron-left" text rounded size="small" :disabled="page <= 1" aria-label="Page précédente" @click="open(current!, page - 1)" />
          <span class="small">Page {{ page }} / {{ base.pages }}</span>
          <Button icon="pi pi-chevron-right" text rounded size="small" :disabled="page >= base.pages" aria-label="Page suivante" @click="open(current!, page + 1)" />
        </template>
        <span class="sep" />
        <Button icon="pi pi-search-minus" text rounded size="small" aria-label="Dézoomer" @click="setZoom(zoom / 1.25)" />
        <button type="button" class="zoom" title="Ajuster à la largeur" @click="setZoom(1)">{{ Math.round(zoom * 100) }} %</button>
        <Button icon="pi pi-search-plus" text rounded size="small" aria-label="Zoomer" @click="setZoom(zoom * 1.25)" />
        <span class="grow" />
        <span v-if="canEdit && renderLabel" class="muted small render-state" :class="renderState">{{ renderLabel }}</span>
        <Button label="PDF du plan" icon="pi pi-file-pdf" severity="secondary" size="small" @click="openPdf" />
        <Button v-if="site?.can.delete" icon="pi pi-trash" text rounded severity="danger" size="small" aria-label="Supprimer le plan" @click="removePlan" />
      </template>
    </header>

    <div class="body">
      <aside class="side left">
        <section>
          <h3>Plans</h3>
          <button v-for="p in plans" :key="p.id" type="button" class="item" :class="{ active: current?.id === p.id }" @click="open(p)">
            <i :class="p.kind === 'pdf' ? 'pi pi-file-pdf' : 'pi pi-image'" />
            <span class="grow">{{ p.name }}</span>
            <span class="muted small">{{ p.markers?.length ?? 0 }}</span>
          </button>
          <p v-if="!plans.length" class="muted small">Aucun plan. Envoyez un PDF ou une image (un DWG est à exporter en PDF).</p>
          <template v-if="site?.can.create">
            <input ref="fileInput" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden @change="onUpload" />
            <Button label="Envoyer un plan" icon="pi pi-upload" size="small" text :loading="uploading" @click="fileInput?.click()" />
          </template>
        </section>

        <section v-if="current">
          <h3>Calques</h3>
          <p v-if="!layers.length" class="muted small">Les repères se rangent par système.</p>
          <div v-for="l in layers" :key="l.key" class="layer">
            <Checkbox :model-value="!l.hidden" binary :input-id="`layer-${l.key}`" @update:model-value="toggleLayer(l.key)" />
            <label :for="`layer-${l.key}`" class="grow" :class="{ muted: l.hidden }">{{ l.name }}</label>
            <span class="muted small">{{ l.count }}</span>
            <Button icon="pi pi-eye" text rounded size="small" title="Afficher seulement ce calque" aria-label="Afficher seulement ce calque" @click="onlyLayer(l.key)" />
          </div>
          <Button v-if="hidden.length" label="Tout afficher" text size="small" @click="updateSettings({ hidden_layers: [] })" />
        </section>

        <section v-if="current">
          <h3>Affichage</h3>
          <label class="toggle"><ToggleSwitch :model-value="current.settings.legend" @update:model-value="(v) => updateSettings({ legend: v })" /> Légende</label>
          <label class="toggle"><ToggleSwitch :model-value="current.settings.labels" @update:model-value="(v) => updateSettings({ labels: v })" /> Noms des repères</label>
          <p class="muted small">Ce qui est affiché ici (calques, légende, noms) est repris dans le PDF du plan et le DOE.</p>
        </section>
      </aside>

      <main ref="viewport" class="canvas" @wheel="onWheel">
        <div v-if="loadingImage" class="center"><ProgressSpinner /></div>
        <div v-else-if="!current" class="center muted">Choisissez ou envoyez un plan.</div>
        <div
          v-else-if="base"
          ref="stage"
          class="stage"
          :class="{ placing: !!tool }"
          :style="{ width: `${zoom * 100}%` }"
          @pointerdown="onStagePointerDown"
          @contextmenu.prevent="openMenu($event, null)"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <img :src="base.url" :alt="current.name" draggable="false" />
          <div
            v-for="m in shownMarkers"
            :key="m.id"
            class="marker"
            :class="{ selected: m.id === selectedId, editable: canEdit }"
            :style="{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.size * 100}%` }"
            :title="m.label ?? equipmentName(m.equipment_id) ?? 'Repère'"
            @pointerdown.stop="startDrag($event, m, 'move')"
            @contextmenu.prevent.stop="openMenu($event, m)"
          >
            <div class="glyph" :style="{ transform: `rotate(${m.rotation}deg)` }">
              <PlanIconGlyph :icon="iconOf(m)" :color="markerColor(m, iconOf(m))" />
            </div>
            <span v-if="labelOf(m)" class="label">{{ labelOf(m) }}</span>
            <template v-if="m.id === selectedId && canEdit">
              <span class="handle resize" title="Redimensionner" @pointerdown.stop="startDrag($event, m, 'resize')" />
              <span class="handle rotate" title="Pivoter (Maj : degré par degré)" @pointerdown.stop="startDrag($event, m, 'rotate')" />
            </template>
          </div>
          <div v-if="current.settings.legend && legend.length" class="legend" @pointerdown.stop>
            <strong>Légende</strong>
            <div v-for="entry in legend" :key="entry.key" class="legend-row">
              <span class="legend-icon"><PlanIconGlyph :icon="entry.icon" :color="entry.color" /></span>
              <span>{{ entry.name }}</span>
              <span class="muted">× {{ entry.count }}</span>
            </div>
          </div>
        </div>
      </main>

      <aside class="side right">
        <section v-if="selected" class="props">
          <div class="props-head">
            <span class="props-icon"><PlanIconGlyph :icon="iconOf(selected)" :color="markerColor(selected, iconOf(selected))" /></span>
            <div class="grow">
              <strong>{{ equipmentName(selected.equipment_id) ?? 'Repère libre' }}</strong>
              <div class="muted small">{{ layers.find((l) => l.key === layerKey(selected!))?.name }}</div>
            </div>
            <Button icon="pi pi-times" text rounded size="small" aria-label="Désélectionner" @click="selectedId = null" />
          </div>
          <template v-if="canEdit">
            <div class="form-field">
              <label for="mk-label">Nom affiché</label>
              <InputText id="mk-label" v-model="labelDraft" :placeholder="equipmentName(selected.equipment_id) ?? 'Nom du repère'" @blur="saveLabel" @keydown.enter="saveLabel" />
            </div>
            <label class="toggle"><ToggleSwitch :model-value="selected.show_label" @update:model-value="(v) => saveMarker(selected!, { show_label: v })" /> Afficher le nom</label>
            <div class="form-field">
              <label>Icône</label>
              <Button :label="iconOf(selected)?.name ?? 'Symbole par défaut'" icon="pi pi-th-large" severity="secondary" size="small" @click="openIconPicker(selected!)" />
            </div>
            <div class="form-field">
              <label>Couleur</label>
              <div class="swatches">
                <button type="button" class="swatch auto" :class="{ active: !selected.color }" title="Couleur de l'icône" @click="saveMarker(selected!, { color: null })">A</button>
                <button v-for="c in COLORS" :key="c" type="button" class="swatch" :class="{ active: selected.color === c }" :style="{ background: c }" :aria-label="c" @click="saveMarker(selected!, { color: c })" />
                <input type="color" class="swatch picker" :value="selected.color ?? '#e11d48'" aria-label="Autre couleur" @change="(e) => saveMarker(selected!, { color: (e.target as HTMLInputElement).value })" />
              </div>
            </div>
            <div class="form-field">
              <label>Taille : {{ sizePercent }} % de la largeur</label>
              <Slider :model-value="sizePercent" :min="0.5" :max="30" :step="0.1" @update:model-value="(v) => (sizePercent = Array.isArray(v) ? v[0]! : v)" @slideend="onSizeEnd" />
            </div>
            <div class="form-field">
              <label>Rotation : {{ rotation }}°</label>
              <div class="rotation">
                <Button icon="pi pi-undo" text rounded size="small" aria-label="−90°" @click="saveMarker(selected!, { rotation: normalizeAngle(selected!.rotation - 90) })" />
                <Slider :model-value="rotation" :min="0" :max="359" class="grow" @update:model-value="(v) => (rotation = Array.isArray(v) ? v[0]! : v)" @slideend="saveMarker(selected!, { rotation: selected!.rotation })" />
                <Button icon="pi pi-refresh" text rounded size="small" aria-label="+90°" @click="saveMarker(selected!, { rotation: normalizeAngle(selected!.rotation + 90) })" />
              </div>
            </div>
            <div class="form-field">
              <label for="mk-layer">Calque</label>
              <Select
                input-id="mk-layer"
                :model-value="selected.installed_system_id ?? selected.layer_id"
                :options="layerOptions"
                option-label="name"
                option-value="id"
                @update:model-value="(v) => saveMarker(selected!, { installed_system_id: v })"
              />
            </div>
            <div class="form-field">
              <label for="mk-eq">Équipement</label>
              <Select
                input-id="mk-eq"
                :model-value="selected.equipment_id"
                :options="equipmentOptions"
                option-label="label"
                option-value="id"
                filter
                @update:model-value="(v) => saveMarker(selected!, { equipment_id: v })"
              />
            </div>
            <div class="props-actions">
              <Button label="Dupliquer" icon="pi pi-copy" text size="small" @click="duplicate(selected!)" />
              <Button label="Supprimer" icon="pi pi-trash" text severity="danger" size="small" @click="removeMarker(selected!)" />
            </div>
            <p class="muted small">Glisser pour déplacer · poignées pour la taille et la rotation · clic droit pour plus d'options · Suppr, R, + et −.</p>
          </template>
          <dl v-else class="facts">
            <dt>Taille</dt><dd>{{ sizePercent }} %</dd>
            <dt>Rotation</dt><dd>{{ selected.rotation }}°</dd>
          </dl>
        </section>

        <section v-else-if="canEdit && current" class="palette">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="paletteSearch" placeholder="Rechercher…" aria-label="Rechercher dans la palette" />
          </IconField>
          <div v-if="tool" class="tool-active">
            <span class="grow">
              Cliquez sur le plan pour poser
              <strong>{{ tool.kind === 'equipment' ? tool.equipment.name : tool.kind === 'icon' ? tool.icon.name : 'un repère libre' }}</strong>
            </span>
            <Button icon="pi pi-times" text rounded size="small" aria-label="Arrêter la pose" @click="tool = null" />
          </div>
          <Tabs v-model:value="paletteTab">
            <TabList>
              <Tab value="equipment">Équipements</Tab>
              <Tab value="icons">Icônes</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="equipment">
                <p v-if="!equipment.length" class="muted small">Aucun équipement : ajoutez-les dans les systèmes du chantier.</p>
                <button
                  v-for="e in paletteEquipment"
                  :key="e.id"
                  type="button"
                  class="pal-item"
                  :class="{ active: tool?.kind === 'equipment' && tool.equipment.id === e.id, placed: placedIds.has(e.id) }"
                  draggable="true"
                  @click="tool = { kind: 'equipment', equipment: e }"
                  @dragstart="onPaletteDragStart($event, { kind: 'equipment', equipment: e })"
                >
                  <span class="pal-icon"><PlanIconGlyph :icon="iconsStore.byId(e.article?.plan_icon_id)" :color="iconsStore.byId(e.article?.plan_icon_id)?.color ?? '#e11d48'" /></span>
                  <span class="grow">
                    {{ e.name }}
                    <span class="muted small">{{ e.system }}</span>
                  </span>
                  <i v-if="placedIds.has(e.id)" class="pi pi-check muted" title="Déjà placé" />
                </button>
              </TabPanel>
              <TabPanel value="icons">
                <div class="form-field">
                  <label for="new-layer">Calque des nouveaux repères</label>
                  <Select input-id="new-layer" v-model="newLayer" :options="layerOptions" option-label="name" option-value="id" />
                </div>
                <button type="button" class="pal-item" :class="{ active: tool?.kind === 'free' }" @click="tool = { kind: 'free' }">
                  <span class="pal-icon"><PlanIconGlyph :icon="null" color="#e11d48" /></span>
                  <span class="grow">Repère libre</span>
                </button>
                <template v-for="[category, list] in paletteIcons" :key="category">
                  <h4>{{ category }}</h4>
                  <div class="icon-grid">
                    <button
                      v-for="icon in list"
                      :key="icon.id"
                      type="button"
                      class="icon-cell"
                      :class="{ active: tool?.kind === 'icon' && tool.icon.id === icon.id }"
                      :title="icon.name"
                      draggable="true"
                      @click="tool = { kind: 'icon', icon }"
                      @dragstart="onPaletteDragStart($event, { kind: 'icon', icon })"
                    >
                      <span class="pal-icon big"><PlanIconGlyph :icon="icon" :color="icon.color ?? '#e11d48'" /></span>
                      <span class="small">{{ icon.name }}</span>
                    </button>
                  </div>
                </template>
                <Button label="Gérer la bibliothèque d'icônes" icon="pi pi-cog" text size="small" @click="router.push({ name: 'plan-icons' })" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </section>
        <section v-else-if="current" class="muted small">Cliquez sur un repère pour voir ses détails.</section>
      </aside>
    </div>

    <ContextMenu ref="menu" :model="menuItems" />

    <Dialog :visible="!!pickerFor" header="Choisir l'icône" modal :style="{ width: '640px' }" @update:visible="(v) => !v && (pickerFor = null)">
      <button type="button" class="pal-item" @click="pickIcon(null)">
        <span class="pal-icon"><PlanIconGlyph :icon="iconsStore.byId(equipmentById.get(pickerFor?.equipment_id ?? 0)?.article?.plan_icon_id)" color="#e11d48" /></span>
        <span class="grow">Icône de l'article (ou symbole par défaut)</span>
      </button>
      <template v-for="[category, list] in paletteIcons" :key="category">
        <h4>{{ category }}</h4>
        <div class="icon-grid">
          <button v-for="icon in list" :key="icon.id" type="button" class="icon-cell" :class="{ active: pickerFor?.plan_icon_id === icon.id }" :title="icon.name" @click="pickIcon(icon)">
            <span class="pal-icon big"><PlanIconGlyph :icon="icon" :color="icon.color ?? '#e11d48'" /></span>
            <span class="small">{{ icon.name }}</span>
          </button>
        </div>
      </template>
      <p v-if="!iconsStore.icons.length" class="muted">La bibliothèque est vide : ajoutez des icônes dans « Stock › Icônes des plans ».</p>
    </Dialog>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
  min-height: 520px;
}
.bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-wrap: wrap;
}
.title {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  margin-right: 0.25rem;
}
.sep {
  width: 1px;
  height: 1.5rem;
  background: var(--p-content-border-color);
  margin: 0 0.25rem;
}
.zoom {
  border: none;
  background: none;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  min-width: 3.5rem;
}
.render-state.error {
  color: var(--p-red-500);
}
.body {
  flex: 1;
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  min-height: 0;
}
.side {
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  border-right: 1px solid var(--p-content-border-color);
}
.side.right {
  border-right: none;
  border-left: 1px solid var(--p-content-border-color);
}
.side h3 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
  margin: 0.75rem 0 0.375rem;
}
.side h4 {
  font-size: 0.8rem;
  margin: 0.75rem 0 0.25rem;
  color: var(--p-text-muted-color);
}
.item,
.pal-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
}
.item:hover,
.pal-item:hover,
.icon-cell:hover {
  background: var(--p-content-hover-background);
}
.item.active,
.pal-item.active,
.icon-cell.active {
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
}
.pal-item.placed {
  opacity: 0.7;
}
.pal-icon {
  width: 22px;
  height: 22px;
  flex: none;
}
.pal-icon.big {
  width: 32px;
  height: 32px;
}
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 0.25rem;
}
.icon-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  border: none;
  background: none;
  color: inherit;
  padding: 0.5rem 0.25rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
}
.layer,
.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.125rem 0;
}
.grow {
  flex: 1;
  min-width: 0;
}
.small {
  font-size: 0.8rem;
}
.canvas {
  overflow: auto;
  background: var(--p-surface-100, #f3f4f6);
  position: relative;
}
:global(.app-dark) .canvas {
  background: var(--p-surface-900, #111827);
}
.center {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.stage {
  position: relative;
  margin: 0 auto;
  touch-action: none;
  user-select: none;
}
.stage.placing {
  cursor: crosshair;
}
.stage > img {
  display: block;
  width: 100%;
  height: auto;
  background: #fff;
}
.marker {
  position: absolute;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  min-width: 10px;
}
.marker.editable {
  cursor: grab;
}
.marker.selected {
  outline: 2px dashed var(--p-primary-color);
  outline-offset: 3px;
  z-index: 2;
}
.glyph {
  width: 100%;
  height: 100%;
}
.label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 2px;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  color: #111827;
  text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 3px #fff;
  pointer-events: none;
}
.handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #fff;
  border: 2px solid var(--p-primary-color);
  border-radius: 50%;
}
.handle.resize {
  right: -9px;
  bottom: -9px;
  cursor: nwse-resize;
}
.handle.rotate {
  left: 50%;
  top: -22px;
  transform: translateX(-50%);
  cursor: grab;
}
.legend {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  background: rgba(255, 255, 255, 0.95);
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  max-width: 45%;
  max-height: 60%;
  overflow: auto;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.legend-icon {
  width: 18px;
  height: 18px;
  flex: none;
}
.props {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.props-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.props-icon {
  width: 32px;
  height: 32px;
}
.props-actions {
  display: flex;
  justify-content: space-between;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.swatch.active {
  border-color: var(--p-text-color);
}
.swatch.auto {
  background: var(--p-content-hover-background);
  font-size: 0.7rem;
  color: var(--p-text-color);
}
.swatch.picker {
  background: none;
  border: 1px solid var(--p-content-border-color);
}
.rotation {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.tool-active {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
  border-radius: 6px;
  padding: 0.375rem 0.5rem;
  margin: 0.5rem 0;
  font-size: 0.85rem;
}
.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 0.75rem;
}
.facts dd {
  margin: 0;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
@media (max-width: 1100px) {
  .body {
    grid-template-columns: 200px 1fr 260px;
  }
}
</style>
