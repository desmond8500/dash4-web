<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, PLAN_SYMBOLS } from '@dash4/shared'
import type { PlanIcon } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { usePlanIconsStore } from '@/stores/planIcons'
import { matchesSearch } from '@/utils/listSearch'
import PlanIconGlyph from '@/components/plans/PlanIconGlyph.vue'

/**
 * Bibliothèque d'icônes des plans : symboles intégrés coloriés ou images envoyées, rangés par catégorie.
 * Une icône choisie sur un article sert à tous ses équipements sur les plans.
 */
const auth = useAuthStore()
const store = usePlanIconsStore()
const router = useRouter()
const confirm = useConfirm()

const COLORS = ['#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#111827']
const canManage = computed(() => auth.canAny(['stock.update', 'sites.create']))
const search = ref('')
const dialog = ref(false)
const edited = ref<PlanIcon | null>(null)
const form = ref({ name: '', category: '', mode: 'symbol' as 'symbol' | 'image', symbol: 'dot', color: '#e11d48' as string | null })
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)
const categorySuggestions = ref<string[]>([])

onMounted(() => void store.load(true))

const categories = computed(() => [...new Set(store.icons.map((i) => i.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'fr')))
const groups = computed(() => {
  const map = new Map<string, PlanIcon[]>()
  for (const icon of store.icons.filter((i) => matchesSearch(search.value, i.name, i.category))) {
    const key = icon.category || 'Sans catégorie'
    map.set(key, [...(map.get(key) ?? []), icon])
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
})

function openDialog(icon: PlanIcon | null): void {
  edited.value = icon
  form.value = {
    name: icon?.name ?? '', category: icon?.category ?? '', mode: icon?.file_path ? 'image' : 'symbol', symbol: icon?.symbol ?? 'dot', color: icon?.color ?? (icon ? null : '#e11d48'),
  }
  file.value = null
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = null
  error.value = null
  dialog.value = true
}

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  input.value = ''
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = file.value ? URL.createObjectURL(file.value) : null
  if (file.value && !form.value.name.trim()) form.value.name = file.value.name.replace(/\.[^.]+$/, '')
}

async function save(): Promise<void> {
  const f = form.value
  if (!f.name.trim()) return void (error.value = "Donnez un nom à l'icône.")
  const image = f.mode === 'image' ? file.value : null
  if (f.mode === 'image' && !image && !edited.value?.file_path) return void (error.value = 'Choisissez une image (PNG, SVG, WebP, 1 Mo au plus).')
  const payload = { name: f.name.trim(), category: f.category.trim() || null, color: f.color, ...(f.mode === 'symbol' ? { symbol: f.symbol } : {}) }
  saving.value = true
  error.value = null
  try {
    const icon = edited.value
      ? await api.planIcons.update(edited.value.id, payload, image ?? undefined, image?.name)
      : await api.planIcons.create(payload, image ?? undefined, image?.name)
    store.upsert(icon)
    dialog.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}

function remove(icon: PlanIcon): void {
  confirm.require({
    header: "Supprimer l'icône",
    message: `Supprimer « ${icon.name} » ?${icon.articles_count ? ` ${icon.articles_count} article(s) l'utilisent : ils reprendront le symbole par défaut.` : ''}`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.planIcons.remove(icon.id)
      store.removeLocal(icon.id)
      dialog.value = false
    },
  })
}

function completeCategory(e: { query: string }): void {
  categorySuggestions.value = categories.value.filter((c) => matchesSearch(e.query, c))
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text rounded aria-label="Retour" @click="router.back()" />
      <h1>Icônes des plans</h1>
      <Button v-if="canManage" label="Nouvelle icône" icon="pi pi-plus" @click="openDialog(null)" />
    </div>
    <p class="muted">
      Choisissez l'icône d'un article dans sa fiche : tous ses équipements la prennent sur les plans. Un symbole intégré se colore ; une image s'affiche telle quelle.
    </p>
    <IconField class="search">
      <InputIcon class="pi pi-search" />
      <InputText v-model="search" placeholder="Rechercher une icône…" aria-label="Rechercher une icône" />
    </IconField>

    <p v-if="!store.icons.length" class="muted">La bibliothèque est vide.</p>
    <template v-for="[category, list] in groups" :key="category">
      <h3>{{ category }}</h3>
      <div class="grid">
        <button v-for="icon in list" :key="icon.id" type="button" class="cell" :disabled="!canManage" @click="openDialog(icon)">
          <span class="glyph"><PlanIconGlyph :icon="icon" :color="icon.color ?? '#e11d48'" /></span>
          <strong>{{ icon.name }}</strong>
          <span v-if="icon.articles_count" class="muted small">{{ icon.articles_count }} article(s)</span>
        </button>
      </div>
    </template>

    <Dialog v-model:visible="dialog" :header="edited ? 'Modifier l\'icône' : 'Nouvelle icône'" modal :style="{ width: '600px' }">
      <form id="icon-form" class="form-grid" @submit.prevent="save">
        <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
        <div class="form-field"><label for="ic-name">Nom</label><InputText id="ic-name" v-model="form.name" placeholder="Caméra dôme" /></div>
        <div class="form-field">
          <label for="ic-cat">Catégorie</label>
          <AutoComplete v-model="form.category" input-id="ic-cat" :suggestions="categorySuggestions" placeholder="Vidéo, incendie, intrusion…" @complete="completeCategory" />
        </div>
        <div class="form-field form-field--full">
          <SelectButton v-model="form.mode" :options="[{ v: 'symbol', l: 'Symbole intégré' }, { v: 'image', l: 'Image' }]" option-label="l" option-value="v" :allow-empty="false" />
        </div>
        <template v-if="form.mode === 'symbol'">
          <div class="form-field form-field--full">
            <label>Symbole</label>
            <div class="symbols">
              <button v-for="s in PLAN_SYMBOLS" :key="s.key" type="button" class="symbol" :class="{ active: form.symbol === s.key }" :title="s.label" @click="form.symbol = s.key">
                <span class="glyph small-glyph"><PlanIconGlyph :icon="null" :symbol="s.key" :color="form.color ?? '#e11d48'" /></span>
              </button>
            </div>
          </div>
        </template>
        <div v-else class="form-field form-field--full">
          <label>Image (PNG, SVG, WebP — 1 Mo au plus, fond transparent conseillé)</label>
          <div class="upload">
            <span v-if="preview" class="glyph"><img :src="preview" alt="" /></span>
            <span v-else-if="edited?.file_path" class="glyph"><PlanIconGlyph :icon="edited" color="#e11d48" /></span>
            <input ref="fileInput" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" hidden @change="onFile" />
            <Button :label="preview || edited?.file_path ? 'Changer l\'image' : 'Choisir une image'" icon="pi pi-upload" severity="secondary" @click="fileInput?.click()" />
          </div>
        </div>
        <div class="form-field form-field--full">
          <label>Couleur par défaut</label>
          <div class="swatches">
            <button v-for="c in COLORS" :key="c" type="button" class="swatch" :class="{ active: form.color === c }" :style="{ background: c }" :aria-label="c" @click="form.color = c" />
            <input v-model="form.color" type="color" class="swatch picker" aria-label="Autre couleur" />
          </div>
        </div>
      </form>
      <template #footer>
        <Button v-if="edited" label="Supprimer" icon="pi pi-trash" text severity="danger" class="left" @click="remove(edited!)" />
        <Button label="Annuler" text severity="secondary" @click="dialog = false" />
        <Button label="Enregistrer" icon="pi pi-check" type="submit" form="icon-form" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.search {
  max-width: 24rem;
  margin: 0.5rem 0 1rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 0.5rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  background: var(--p-content-background);
  color: inherit;
  cursor: pointer;
  text-align: center;
}
.cell:hover:not(:disabled) {
  border-color: var(--p-primary-color);
}
.cell:disabled {
  cursor: default;
}
.glyph {
  width: 40px;
  height: 40px;
  display: inline-block;
}
.glyph img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.small-glyph {
  width: 28px;
  height: 28px;
}
.symbols {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 0.25rem;
}
.symbol {
  border: 2px solid transparent;
  border-radius: 6px;
  background: var(--p-content-hover-background);
  padding: 0.375rem;
  cursor: pointer;
  display: flex;
  justify-content: center;
}
.symbol.active {
  border-color: var(--p-primary-color);
}
.upload {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.swatches {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}
.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.swatch.active {
  border-color: var(--p-text-color);
}
.swatch.picker {
  background: none;
  border: 1px solid var(--p-content-border-color);
}
.left {
  margin-right: auto;
}
.small {
  font-size: 0.8rem;
}
h3 {
  margin: 1rem 0 0.5rem;
  font-size: 0.95rem;
}
</style>
