<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Rating from 'primevue/rating'
import ToggleSwitch from 'primevue/toggleswitch'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { ApiError, CV_SECTION_TYPES, cleanCvSections, cvDateRange, cvSectionHasLevel, emptyCvItem, moveCvEntry } from '@dash4/shared'
import type { Cv, CvSection, CvSectionType } from '@dash4/shared'
import { api } from '@/services/api'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

const cv = ref<Cv | null>(null)
const sections = ref<CvSection[]>([])
const saving = ref(false)
const importing = ref(false)
const photoInput = ref<HTMLInputElement | null>(null)
const newSectionType = ref<CvSectionType>('free')

const fonts = [
  { value: 'sans', label: 'Sans empattement' },
  { value: 'serif', label: 'Avec empattement' },
  { value: 'mono', label: 'Machine à écrire' },
]
const layouts = [
  { value: 'two_columns', label: 'Deux colonnes' },
  { value: 'one_column', label: 'Une colonne' },
]
const readOnly = computed(() => !cv.value?.can.update)

function load(data: Cv): void {
  cv.value = data
  sections.value = structuredClone(data.sections)
}

onMounted(async () => {
  load(await api.cvs.get(Number(route.params.id)))
})

async function save(): Promise<void> {
  const c = cv.value
  if (!c) return
  saving.value = true
  try {
    load(
      await api.cvs.update(c.id, {
        name: c.name,
        title: c.title,
        fullname: c.fullname,
        summary: c.summary,
        phone: c.phone,
        email: c.email || null,
        address: c.address,
        website: c.website,
        accent_color: c.accent_color,
        font: c.font,
        layout: c.layout,
        show_photo: c.show_photo,
        shared: c.shared,
        sections: cleanCvSections(sections.value),
      }),
    )
    toast.add({ severity: 'success', summary: 'CV enregistré', life: 2500 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: errorDetail(e), life: 6000 })
  } finally {
    saving.value = false
  }
}

async function importProjects(): Promise<void> {
  if (!cv.value) return
  await save()
  importing.value = true
  try {
    load(await api.cvs.importProjects(cv.value.id))
    toast.add({ severity: 'success', summary: 'Projets ajoutés', detail: 'Complétez la section « Projets réalisés ».', life: 3500 })
  } finally {
    importing.value = false
  }
}

async function onPhoto(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !cv.value) return
  try {
    const updated = await api.cvs.uploadPhoto(cv.value.id, file, file.name)
    cv.value.photo_url = updated.photo_url
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Photo refusée', detail: errorDetail(e), life: 6000 })
  }
}

async function pdf(): Promise<void> {
  if (!cv.value) return
  await save()
  const url = URL.createObjectURL(await api.cvs.pdf(cv.value.id))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function addSection(): void {
  const label = CV_SECTION_TYPES.find((t) => t.value === newSectionType.value)?.label ?? 'Section'
  sections.value.push({ name: label, type: newSectionType.value, items: [emptyCvItem()] })
}
function moveSection(i: number, delta: -1 | 1): void {
  sections.value = moveCvEntry(sections.value, i, delta)
}
function moveItem(section: CvSection, j: number, delta: -1 | 1): void {
  section.items = moveCvEntry(section.items, j, delta)
}
</script>

<template>
  <div v-if="cv" class="page">
    <div class="page-header">
      <div>
        <Button icon="pi pi-arrow-left" text label="Mon profil" @click="router.push({ name: 'profile' })" />
        <h1>{{ cv.name }}</h1>
      </div>
      <div class="header-actions">
        <Button label="PDF" icon="pi pi-file-pdf" severity="secondary" @click="pdf" />
        <Button v-if="!readOnly" label="Enregistrer" icon="pi pi-check" :loading="saving" @click="save" />
      </div>
    </div>

    <Card>
      <template #title>En-tête et mise en page</template>
      <template #content>
        <div class="head">
          <div class="photo-block">
            <img v-if="cv.photo_url" :src="cv.photo_url" alt="" class="photo" />
            <div v-else class="photo photo-empty"><i class="pi pi-user" /></div>
            <Button v-if="!readOnly" label="Photo" icon="pi pi-camera" size="small" text @click="photoInput?.click()" />
            <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPhoto" />
          </div>
          <div class="grid">
            <label>Nom du CV <InputText v-model="cv!.name" :disabled="readOnly" /></label>
            <label>Nom affiché <InputText v-model="cv!.fullname" :disabled="readOnly" /></label>
            <label>Titre <InputText v-model="cv!.title" :disabled="readOnly" placeholder="Chef de projet courants faibles" /></label>
            <label>E-mail <InputText v-model="cv!.email" :disabled="readOnly" /></label>
            <label>Téléphone <InputText v-model="cv!.phone" :disabled="readOnly" /></label>
            <label>Adresse <InputText v-model="cv!.address" :disabled="readOnly" /></label>
            <label>Site / LinkedIn <InputText v-model="cv!.website" :disabled="readOnly" /></label>
            <label class="wide">Résumé <Textarea v-model="cv!.summary" rows="3" auto-resize :disabled="readOnly" /></label>
            <label>Couleur <input v-model="cv!.accent_color" type="color" class="color" :disabled="readOnly" /></label>
            <label>Police <Select v-model="cv!.font" :options="fonts" option-label="label" option-value="value" :disabled="readOnly" /></label>
            <label>Disposition <Select v-model="cv!.layout" :options="layouts" option-label="label" option-value="value" :disabled="readOnly" /></label>
            <div class="switches">
              <label class="inline"><ToggleSwitch v-model="cv!.show_photo" :disabled="readOnly" /> Afficher la photo</label>
              <label class="inline"><ToggleSwitch v-model="cv!.shared" :disabled="readOnly" /> Partager avec les administrateurs</label>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card v-for="(section, i) in sections" :key="i">
      <template #title>
        <div class="section-head">
          <InputText v-model="section.name" class="section-name" :disabled="readOnly" />
          <span class="muted type">{{ CV_SECTION_TYPES.find((t) => t.value === section.type)?.label }}</span>
          <span class="spacer" />
          <template v-if="!readOnly">
            <Button icon="pi pi-arrow-up" text rounded aria-label="Monter" :disabled="i === 0" @click="moveSection(i, -1)" />
            <Button icon="pi pi-arrow-down" text rounded aria-label="Descendre" :disabled="i === sections.length - 1" @click="moveSection(i, 1)" />
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer la section" @click="sections.splice(i, 1)" />
          </template>
        </div>
      </template>
      <template #content>
        <div v-for="(item, j) in section.items" :key="j" class="item">
          <div class="item-grid">
            <label>Intitulé <InputText v-model="item.title" :disabled="readOnly" /></label>
            <template v-if="cvSectionHasLevel(section.type)">
              <label>Précision <InputText v-model="item.subtitle" :disabled="readOnly" placeholder="Courant, bilingue…" /></label>
              <label>Niveau <Rating v-model="item.level" :stars="5" :disabled="readOnly" /></label>
            </template>
            <template v-else>
              <label>{{ section.type === 'education' ? 'Établissement' : 'Entreprise / client' }} <InputText v-model="item.subtitle" :disabled="readOnly" /></label>
              <label>Lieu <InputText v-model="item.place" :disabled="readOnly" /></label>
              <label>Début <InputText v-model="item.start_date" :disabled="readOnly" placeholder="2020 ou 03/2020" /></label>
              <label>Fin <InputText v-model="item.end_date" :disabled="readOnly || item.current" /></label>
              <label class="inline"><Checkbox v-model="item.current" binary :disabled="readOnly" /> En cours</label>
            </template>
            <label class="wide">Description <Textarea v-model="item.description" rows="2" auto-resize :disabled="readOnly" /></label>
          </div>
          <div class="item-side">
            <span class="muted small">{{ cvDateRange(item) }}</span>
            <template v-if="!readOnly">
              <Button icon="pi pi-arrow-up" text rounded size="small" aria-label="Monter" :disabled="j === 0" @click="moveItem(section, j, -1)" />
              <Button icon="pi pi-arrow-down" text rounded size="small" aria-label="Descendre" :disabled="j === section.items.length - 1" @click="moveItem(section, j, 1)" />
              <Button icon="pi pi-times" text rounded size="small" severity="danger" aria-label="Retirer" @click="section.items.splice(j, 1)" />
            </template>
          </div>
        </div>
        <Button v-if="!readOnly" label="Ajouter un élément" icon="pi pi-plus" text size="small" @click="section.items.push(emptyCvItem())" />
      </template>
    </Card>

    <div v-if="!readOnly" class="add-section">
      <Select v-model="newSectionType" :options="CV_SECTION_TYPES" option-label="label" option-value="value" />
      <Button label="Ajouter une section" icon="pi pi-plus" severity="secondary" @click="addSection" />
      <span class="spacer" />
      <Button label="Ajouter mes projets Dash4" icon="pi pi-briefcase" severity="secondary" :loading="importing" @click="importProjects" />
    </div>
  </div>
  <div v-else class="loading"><ProgressSpinner /></div>
</template>

<style scoped>
.header-actions,
.add-section,
.section-head,
.switches {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.head {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.photo-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
.photo {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
}
.photo-empty {
  display: grid;
  place-items: center;
  background: var(--p-content-hover-background);
  font-size: 2rem;
  color: var(--p-text-muted-color);
}
.grid,
.item-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem 1rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
label.inline {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}
.wide,
.switches {
  grid-column: 1 / -1;
}
.color {
  width: 4rem;
  height: 2.5rem;
  border: none;
  background: none;
}
.section-name {
  font-weight: 600;
}
.type {
  font-size: 0.85rem;
  font-weight: normal;
}
.item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.item-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 6rem;
}
.small {
  font-size: 0.8rem;
}
.spacer {
  flex: 1;
}
.loading {
  display: grid;
  place-items: center;
  padding: 4rem;
}
</style>
