<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useRouter } from 'vue-router'
import { ApiError, placeLabel, relativePosition } from '@dash4/shared'
import type { Equipment, Plan, PlanMarker, Site } from '@dash4/shared'
import { api } from '@/services/api'
import { equipmentStatusSeverity } from '@/utils/site'

/** Plans du chantier : envoi (PDF ou image), affichage avec zoom, marqueurs d'équipements. */
const props = defineProps<{ site: Site }>()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const plans = ref<Plan[]>([])
const current = ref<Plan | null>(null)
const image = ref<{ url: string; pages: number } | null>(null)
const page = ref(1)
const loadingImage = ref(false)
const zoom = ref(1)
const placing = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selected = ref<PlanMarker | null>(null)
const draft = ref<{ open: boolean; x: number; y: number; equipment_id: number | null; label: string; color: string }>({ open: false, x: 0, y: 0, equipment_id: null, label: '', color: '#e11d48' })

const can = computed(() => props.site.can)
const equipment = computed(() => props.site.systems.flatMap((s) => (s.equipment ?? []).map((e) => ({ ...e, system: s.name }))))
const placedIds = computed(() => new Set(plans.value.flatMap((p) => (p.markers ?? []).map((m) => m.equipment_id)).filter(Boolean)))
const options = computed(() => [
  { id: null as number | null, label: 'Repère libre (sans équipement)' },
  ...equipment.value.map((e) => ({ id: e.id as number | null, label: `${placedIds.value.has(e.id) ? '✓ ' : ''}${e.name} — ${e.system}` })),
])
const pageMarkers = computed(() => (current.value?.markers ?? []).filter((m) => m.page === page.value))
const findEquipment = (id: number | null): (Equipment & { system: string }) | undefined => equipment.value.find((e) => e.id === id)
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  plans.value = await api.plans.list(props.site.project.id).catch(() => [])
  if (!current.value && plans.value.length) void open(plans.value[0]!)
}
watch(() => props.site.project.id, load, { immediate: true })

function release(): void {
  if (image.value) URL.revokeObjectURL(image.value.url)
  image.value = null
}
onBeforeUnmount(release)

async function open(plan: Plan, pageNumber = 1): Promise<void> {
  const same = current.value?.id === plan.id
  current.value = plan
  selected.value = null
  if (same && page.value === pageNumber && image.value) return
  page.value = pageNumber
  loadingImage.value = true
  release()
  try {
    const blob = await api.plans.file(plan)
    if (plan.kind === 'pdf') {
      const { pdfPageImage } = await import('@/utils/pdf')
      const result = await pdfPageImage(await blob.arrayBuffer(), pageNumber)
      image.value = { url: result.url, pages: result.pages }
    } else {
      image.value = { url: URL.createObjectURL(blob), pages: 1 }
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Plan illisible', detail: errorDetail(e), life: 5000 })
  } finally {
    loadingImage.value = false
  }
}

async function onUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    const plan = await api.plans.upload(props.site.project.id, file, file.name)
    plans.value = [...plans.value, plan]
    await open(plan)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Plan refusé', detail: errorDetail(e), life: 6000 })
  } finally {
    uploading.value = false
  }
}

function replace(plan: Plan): void {
  plans.value = plans.value.map((p) => (p.id === plan.id ? plan : p))
  if (current.value?.id === plan.id) current.value = plan
}

function onImageClick(event: MouseEvent): void {
  if (!placing.value || !can.value.manage) return
  const pos = relativePosition(event.clientX, event.clientY, (event.currentTarget as HTMLElement).getBoundingClientRect())
  draft.value = { ...draft.value, open: true, ...pos, equipment_id: null, label: '' }
}
async function saveMarker(): Promise<void> {
  if (!current.value) return
  const d = draft.value
  try {
    replace(await api.plans.addMarker(current.value.id, {
      x: d.x, y: d.y, page: page.value, equipment_id: d.equipment_id, label: d.label.trim() || null, color: d.color, client_uuid: crypto.randomUUID(),
    }))
    draft.value.open = false
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Repère refusé', detail: errorDetail(e), life: 5000 })
  }
}
async function removeMarker(m: PlanMarker): Promise<void> {
  replace(await api.plans.removeMarker(m.id))
  selected.value = null
}

function rename(plan: Plan): void {
  const name = window.prompt('Nom du plan', plan.name)?.trim()
  if (name && name !== plan.name) void api.plans.update(plan.id, { name }).then(replace)
}
function remove(plan: Plan): void {
  confirm.require({
    header: 'Supprimer le plan',
    message: `Supprimer « ${plan.name} » et ses repères ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.plans.remove(plan.id)
      plans.value = plans.value.filter((p) => p.id !== plan.id)
      if (current.value?.id === plan.id) {
        current.value = null
        release()
      }
    },
  })
}
</script>

<template>
  <div class="plans">
    <aside class="list">
      <button v-for="p in plans" :key="p.id" type="button" class="item" :class="{ active: current?.id === p.id }" @click="open(p)">
        <i :class="p.kind === 'pdf' ? 'pi pi-file-pdf' : 'pi pi-image'" />
        <span class="grow">{{ p.name }}</span>
        <span class="muted small">{{ p.markers?.length ?? 0 }}</span>
      </button>
      <p v-if="!plans.length" class="muted small">Aucun plan. Envoyez un PDF ou une image (les DWG sont à exporter en PDF).</p>
      <template v-if="can.create">
        <input ref="fileInput" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden @change="onUpload" />
        <Button label="Envoyer un plan" icon="pi pi-upload" size="small" text :loading="uploading" @click="fileInput?.click()" />
      </template>
      <Button v-if="plans.length" label="Éditeur de plans" icon="pi pi-pencil" size="small" text @click="router.push({ name: 'plan-editor', params: { projectId: props.site.project.id } })" />
    </aside>

    <section v-if="current" class="viewer">
      <div class="toolbar">
        <strong class="grow">{{ current.name }}</strong>
        <template v-if="image && image.pages > 1">
          <Button icon="pi pi-chevron-left" text rounded size="small" :disabled="page <= 1" aria-label="Page précédente" @click="open(current!, page - 1)" />
          <span class="small">Page {{ page }} / {{ image.pages }}</span>
          <Button icon="pi pi-chevron-right" text rounded size="small" :disabled="page >= image.pages" aria-label="Page suivante" @click="open(current!, page + 1)" />
        </template>
        <Button icon="pi pi-search-minus" text rounded size="small" :disabled="zoom <= 0.5" aria-label="Dézoomer" @click="zoom = Math.max(0.5, zoom - 0.25)" />
        <span class="small">{{ Math.round(zoom * 100) }} %</span>
        <Button icon="pi pi-search-plus" text rounded size="small" :disabled="zoom >= 4" aria-label="Zoomer" @click="zoom = Math.min(4, zoom + 0.25)" />
        <Button label="Ouvrir l'éditeur" icon="pi pi-external-link" size="small" @click="router.push({ name: 'plan-editor', params: { projectId: props.site.project.id, planId: current!.id } })" />
        <Button v-if="can.manage" :label="placing ? 'Terminer' : 'Placer des repères'" :icon="placing ? 'pi pi-check' : 'pi pi-map-marker'" size="small" :severity="placing ? 'success' : 'secondary'" @click="placing = !placing" />
        <Button v-if="can.manage" icon="pi pi-pencil" text rounded size="small" aria-label="Renommer" @click="rename(current!)" />
        <Button v-if="can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer le plan" @click="remove(current!)" />
      </div>
      <p v-if="placing" class="hint small">Cliquez sur le plan à l'endroit de l'équipement.</p>
      <div class="canvas">
        <div v-if="loadingImage" class="center"><ProgressSpinner /></div>
        <div v-else-if="image" class="stage" :style="{ width: `${zoom * 100}%` }">
          <img :src="image.url" :alt="current.name" :class="{ crosshair: placing }" draggable="false" @click="onImageClick" />
          <button
            v-for="m in pageMarkers"
            :key="m.id"
            type="button"
            class="marker"
            :style="{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, background: m.color ?? '#e11d48' }"
            :title="m.label ?? findEquipment(m.equipment_id)?.name ?? 'Repère'"
            @click.stop="selected = m"
          >
            <span>{{ m.label ?? findEquipment(m.equipment_id)?.name ?? '' }}</span>
          </button>
        </div>
      </div>
    </section>
    <section v-else class="viewer center muted">Choisissez ou envoyez un plan.</section>

    <Dialog v-model:visible="draft.open" header="Nouveau repère" modal :style="{ width: '440px' }">
      <form id="marker-form" class="form-grid" @submit.prevent="saveMarker">
        <div class="form-field form-field--full">
          <label for="mk-eq">Équipement</label>
          <Select id="mk-eq" v-model="draft.equipment_id" :options="options" option-label="label" option-value="id" filter />
        </div>
        <div class="form-field"><label for="mk-label">Libellé</label><InputText id="mk-label" v-model="draft.label" placeholder="C1, Z3…" /></div>
        <div class="form-field"><label for="mk-color">Couleur</label><input id="mk-color" v-model="draft.color" type="color" class="color" /></div>
      </form>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="draft.open = false" />
        <Button label="Placer" icon="pi pi-map-marker" type="submit" form="marker-form" />
      </template>
    </Dialog>

    <Dialog :visible="!!selected" :header="selected?.label ?? findEquipment(selected?.equipment_id ?? null)?.name ?? 'Repère'" modal :style="{ width: '440px' }" @update:visible="(v: boolean) => !v && (selected = null)">
      <template v-if="selected">
        <template v-if="findEquipment(selected.equipment_id)">
          <p><strong>{{ findEquipment(selected.equipment_id)!.name }}</strong> <span class="muted">— {{ findEquipment(selected.equipment_id)!.system }}</span></p>
          <p><Tag :value="findEquipment(selected.equipment_id)!.status.label" :severity="equipmentStatusSeverity(findEquipment(selected.equipment_id)!.status.value)" /></p>
          <p class="muted small">{{ placeLabel(site, findEquipment(selected.equipment_id)!.level_id, findEquipment(selected.equipment_id)!.room_id) }}</p>
          <div v-for="c in findEquipment(selected.equipment_id)!.characteristics" :key="c.label" class="small"><span class="muted">{{ c.label }} :</span> <code>{{ c.value }}</code></div>
        </template>
        <p v-else class="muted">Repère libre.</p>
      </template>
      <template #footer>
        <Button v-if="can.manage && selected" label="Retirer le repère" icon="pi pi-trash" text severity="danger" @click="removeMarker(selected!)" />
        <Button label="Fermer" text severity="secondary" @click="selected = null" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.plans {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 1rem;
  min-height: 420px;
}

@media (max-width: 900px) {
  .plans {
    grid-template-columns: 1fr;
  }
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item.active,
.item:hover {
  background: var(--p-content-hover-background);
  border-color: var(--p-content-border-color);
}

.viewer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.hint {
  margin: 0;
  color: var(--p-primary-color);
}

.canvas {
  overflow: auto;
  max-height: 75vh;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  background: var(--p-content-hover-background);
}

.stage {
  position: relative;
  min-width: 100%;
}

.stage img {
  display: block;
  width: 100%;
  user-select: none;
}

.crosshair {
  cursor: crosshair;
}

.marker {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
  padding: 0;
  cursor: pointer;
}

.marker span {
  position: absolute;
  left: 20px;
  top: -3px;
  white-space: nowrap;
  font-size: 0.7rem;
  font-weight: 600;
  color: #111827;
  background: rgb(255 255 255 / 0.85);
  padding: 0 0.25rem;
  border-radius: 3px;
}

.marker span:empty {
  display: none;
}

.center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.color {
  width: 3rem;
  height: 2.25rem;
  border: 0;
  background: none;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.85rem;
}
</style>
