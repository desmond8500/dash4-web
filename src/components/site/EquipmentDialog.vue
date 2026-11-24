<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import ArticleOption from '@/components/stock/ArticleOption.vue'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, EQUIPMENT_STATUSES } from '@dash4/shared'
import type { Article, Equipment, InstalledSystem, Site } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { equipmentForm, equipmentPayload, type EquipmentForm } from '@/utils/site'

/** Ajout ou modification d'un équipement : article du stock (sans prix), emplacement, caractéristiques. */
const props = defineProps<{ site: Site; system: InstalledSystem | null; equipment?: Equipment | null; parentId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [site: Site] }>()
const auth = useAuthStore()

const form = ref<EquipmentForm>(equipmentForm())
const article = ref<Article | { id: number; designation: string; reference: string | null } | null>(null)
const suggestions = ref<Article[]>([])
const error = ref<string | null>(null)
const saving = ref(false)

const parents = computed(() => (props.system?.equipment ?? []).filter((e) => e.parent_id === null && e.id !== props.equipment?.id))
const places = computed(() =>
  props.site.buildings.flatMap((b) => b.levels.flatMap((l) => [
    { key: `l${l.id}`, label: `${b.name} › ${l.name}`, level_id: l.id, room_id: null as number | null },
    ...l.rooms.map((r) => ({ key: `r${r.id}`, label: `${b.name} › ${l.name} › ${r.name}`, level_id: l.id, room_id: r.id as number | null })),
  ])),
)
const placeKey = computed({
  get: () => (form.value.room_id ? `r${form.value.room_id}` : form.value.level_id ? `l${form.value.level_id}` : null),
  set: (key: string | null) => {
    const p = places.value.find((x) => x.key === key)
    form.value.level_id = p?.level_id ?? null
    form.value.room_id = p?.room_id ?? null
  },
})

watch(visible, (open) => {
  if (!open) return
  error.value = null
  form.value = equipmentForm(props.equipment, props.parentId ?? null)
  article.value = props.equipment?.article ?? null
})

async function searchArticles(e: { query: string }): Promise<void> {
  suggestions.value = (await api.articles.list({ search: e.query, per_page: 15 }).catch(() => ({ data: [] as Article[] }))).data
}
function onArticle(a: Article | null): void {
  form.value.article_id = a?.id ?? null
  if (a && !form.value.name.trim()) form.value.name = a.designation
}

function addCharacteristic(): void {
  form.value.characteristics.push({ label: '', value: '' })
}

async function save(): Promise<void> {
  if (!props.system) return
  if (!form.value.name.trim() && !form.value.article_id) {
    error.value = "Donnez un nom à l'équipement ou choisissez un article."
    return
  }
  saving.value = true
  try {
    const payload = equipmentPayload(form.value)
    const site = props.equipment
      ? await api.sites.updateEquipment(props.equipment.id, payload)
      : await api.sites.addEquipment(props.system.id, { ...payload, client_uuid: crypto.randomUUID() })
    visible.value = false
    emit('saved', site)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.equipment ? 'Modifier l\'équipement' : 'Nouvel équipement'" modal :style="{ width: '640px' }" :breakpoints="{ '680px': '95vw' }">
    <form id="equipment-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div v-if="auth.can('stock.view')" class="form-field form-field--full">
        <label for="eq-article">Article du stock</label>
        <AutoComplete v-model="article" input-id="eq-article" :suggestions="suggestions" option-label="designation" force-selection placeholder="Rechercher un article (facultatif)" @complete="searchArticles" @option-select="(e) => onArticle(e.value)" @clear="onArticle(null)">
          <template #option="{ option }"><ArticleOption :article="option" /></template>
        </AutoComplete>
      </div>
      <div class="form-field"><label for="eq-name">Nom</label><InputText id="eq-name" v-model="form.name" placeholder="Enregistreur, caméra entrée…" /></div>
      <div class="form-field"><label for="eq-type">Type</label><InputText id="eq-type" v-model="form.type" placeholder="NVR, Caméra, Détecteur…" /></div>
      <div class="form-field"><label for="eq-model">Modèle</label><InputText id="eq-model" v-model="form.model" /></div>
      <div class="form-field"><label for="eq-serial">N° de série</label><InputText id="eq-serial" v-model="form.serial_number" /></div>
      <div class="form-field"><label for="eq-qty">Quantité</label><InputNumber v-model="form.quantity" input-id="eq-qty" :min="1" show-buttons /></div>
      <div class="form-field"><label for="eq-status">État</label><Select id="eq-status" v-model="form.status" :options="EQUIPMENT_STATUSES" option-label="label" option-value="value" /></div>
      <div v-if="places.length" class="form-field">
        <label for="eq-place">Emplacement</label>
        <Select id="eq-place" v-model="placeKey" :options="[{ key: null, label: '—' }, ...places]" option-label="label" option-value="key" filter />
      </div>
      <div v-if="parents.length" class="form-field">
        <label for="eq-parent">Rattaché à</label>
        <Select id="eq-parent" v-model="form.parent_id" :options="[{ id: null, name: 'Équipement principal' }, ...parents]" option-label="name" option-value="id" />
      </div>
      <div class="form-field form-field--full">
        <label>Caractéristiques</label>
        <div v-for="(c, i) in form.characteristics" :key="i" class="row">
          <InputText v-model="c.label" placeholder="Adresse IP, port, identifiant…" class="grow" />
          <InputText v-model="c.value" placeholder="Valeur" class="grow" />
          <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="form.characteristics.splice(i, 1)" />
        </div>
        <Button label="Ajouter une caractéristique" icon="pi pi-plus" text size="small" @click="addCharacteristic" />
      </div>
      <div class="form-field form-field--full"><label for="eq-desc">Description</label><MarkdownEditor id="eq-desc" v-model="form.description" rows="2" auto-resize /></div>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="equipment-form" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.row {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-bottom: 0.375rem;
}

.grow {
  flex: 1;
}
</style>
