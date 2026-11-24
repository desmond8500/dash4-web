<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { ApiError } from '@dash4/shared'
import type { Article, StorageLocation, Tool, ToolCondition, ToolOptions, ToolPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { fromApiDate, toApiDate } from '@/utils/projects'
import ArticlePicker from '@/components/stock/ArticlePicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

/**
 * Création ou modification d'un outil, lié à un article du stock. À la création, plusieurs exemplaires
 * peuvent être créés d'un coup (numéros suffixés -01, -02…).
 */
const props = defineProps<{ tool: Tool | null; options: ToolOptions | null; article?: Article | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [tools: Tool[]] }>()
const auth = useAuthStore()

const locations = ref<StorageLocation[]>([])
const error = ref<string | null>(null)
const saving = ref(false)
const article = ref<{ id: number; designation: string; reference: string | null } | null>(null)
const blank = () => ({
  name: '', code: '', serial_number: '', condition: 'good' as ToolCondition, storage_location_id: null as number | null,
  acquired: null as Date | null, purchase_value: null as number | null, notes: '', count: 1 as number | null,
})
const form = ref(blank())
const canCosts = computed(() => auth.can('costs.view'))

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  const t = props.tool
  form.value = t
    ? {
        name: t.name, code: t.code ?? '', serial_number: t.serial_number ?? '', condition: t.condition.value, storage_location_id: t.storage_location_id,
        acquired: fromApiDate(t.acquired_on), purchase_value: t.purchase_value ?? null, notes: t.notes ?? '', count: 1,
      }
    : blank()
  article.value = t?.article ?? (props.article ? { id: props.article.id, designation: props.article.designation, reference: props.article.reference } : null)
  if (!t && props.article && canCosts.value && props.article.unit_cost !== undefined) form.value.purchase_value = Math.round(props.article.unit_cost)
  if (!locations.value.length) locations.value = await api.storageLocations.list().catch(() => [])
})

function pickArticle(a: Article): void {
  article.value = { id: a.id, designation: a.designation, reference: a.reference }
  if (!form.value.name.trim()) form.value.name = a.designation
  if (!props.tool && canCosts.value && form.value.purchase_value === null && a.unit_cost !== undefined) form.value.purchase_value = Math.round(a.unit_cost)
}

async function save(): Promise<void> {
  const f = form.value
  if (!f.name.trim() && !article.value) return void (error.value = "Donnez un nom à l'outil ou choisissez l'article du stock.")
  const payload: ToolPayload = {
    article_id: article.value?.id ?? null, name: f.name.trim() || null, code: f.code.trim() || null, serial_number: f.serial_number.trim() || null,
    condition: f.condition, storage_location_id: f.storage_location_id, acquired_on: toApiDate(f.acquired), notes: f.notes.trim() || null,
    ...(canCosts.value ? { purchase_value: f.purchase_value === null ? null : Math.round(f.purchase_value) } : {}),
  }
  saving.value = true
  error.value = null
  try {
    const count = Math.max(1, Math.round(f.count ?? 1))
    const saved = props.tool
      ? [await api.tools.update(props.tool.id, payload)]
      : count > 1
        ? await api.tools.createMany(payload, count)
        : [await api.tools.create(payload)]
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.tool ? 'Modifier l’outil' : 'Nouvel outil'" modal :style="{ width: '640px' }" :breakpoints="{ '680px': '96vw' }">
    <form id="tool-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field form-field--full">
        <label for="t-article">Article du stock</label>
        <div v-if="article" class="article">
          <i class="pi pi-box" aria-hidden="true" />
          <span class="grow">{{ article.designation }}<span v-if="article.reference" class="muted"> · {{ article.reference }}</span></span>
          <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer l'article" @click="article = null" />
        </div>
        <ArticlePicker v-else input-id="t-article" placeholder="Chercher l'article (perceuse, échelle, testeur…)" @select="pickArticle" />
      </div>
      <div class="form-field"><label for="t-name">Nom</label><InputText id="t-name" v-model="form.name" placeholder="Reprend l'article si vide" /></div>
      <div class="form-field">
        <label for="t-code">N° d'inventaire</label>
        <InputText id="t-code" v-model="form.code" placeholder="OUT-012" />
      </div>
      <div v-if="!props.tool" class="form-field">
        <label for="t-count">Nombre d'exemplaires</label>
        <InputNumber v-model="form.count" input-id="t-count" :min="1" :max="50" show-buttons />
        <small v-if="(form.count ?? 1) > 1 && form.code.trim()" class="muted">Numéros {{ form.code.trim() }}-01 à {{ form.code.trim() }}-{{ String(form.count).padStart(2, '0') }}</small>
      </div>
      <div class="form-field"><label for="t-serial">N° de série</label><InputText id="t-serial" v-model="form.serial_number" /></div>
      <div class="form-field"><label for="t-cond">État</label><Select id="t-cond" v-model="form.condition" :options="props.options?.conditions ?? []" option-label="label" option-value="value" /></div>
      <div class="form-field">
        <label for="t-loc">Rangé à</label>
        <Select id="t-loc" v-model="form.storage_location_id" :options="[{ id: null, name: '—' }, ...locations]" option-label="name" option-value="id" filter />
      </div>
      <div class="form-field"><label for="t-acq">Acquis le</label><DatePicker v-model="form.acquired" input-id="t-acq" date-format="dd/mm/yy" show-button-bar /></div>
      <div v-if="canCosts" class="form-field"><label for="t-value">Valeur d'achat</label><InputNumber v-model="form.purchase_value" input-id="t-value" :min="0" suffix=" F" /></div>
      <div class="form-field form-field--full"><label for="t-notes">Notes</label><MarkdownEditor id="t-notes" v-model="form.notes" rows="3" /></div>
    </form>
    <template #footer>
      <Button label="Annuler" text severity="secondary" @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="tool-form" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.article {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-border-radius-md, 6px);
}
.grow {
  flex: 1;
}
</style>
