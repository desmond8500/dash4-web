<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, formatMoney, QUOTE_LINE_CATEGORY_LABELS } from '@dash4/shared'
import type { Article, ArticlePayload, Brand, Provider, QuoteLineCategory, StorageLocation } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/** Création ou modification d'un article. Coût et coefficient : costs.view. */
const props = defineProps<{ article?: Article | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [article: Article] }>()
const auth = useAuthStore()

const categories = (Object.entries(QUOTE_LINE_CATEGORY_LABELS) as Array<[QuoteLineCategory, string]>).map(([value, label]) => ({ value, label }))
const brands = ref<Brand[]>([])
const providers = ref<Provider[]>([])
const locations = ref<StorageLocation[]>([])
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)
const canCosts = computed(() => auth.can('costs.view'))
const creating = computed(() => !props.article)

const form = reactive({
  designation: '',
  reference: '',
  barcode: '',
  category: 'device' as QuoteLineCategory,
  unit: 'u',
  brand_id: null as number | null,
  provider_id: null as number | null,
  unit_cost: 0,
  coefficient: 1,
  min_quantity: null as number | null,
  storage_location_id: null as number | null,
  description: '',
  is_active: true,
  initial_quantity: null as number | null,
})

watch(visible, async (open) => {
  if (!open) return
  errors.value = {}
  generalError.value = null
  const a = props.article
  Object.assign(form, {
    designation: a?.designation ?? '',
    reference: a?.reference ?? '',
    barcode: a?.barcode ?? '',
    category: a?.category.value ?? 'device',
    unit: a?.unit ?? 'u',
    brand_id: a?.brand_id ?? null,
    provider_id: a?.provider_id ?? null,
    unit_cost: a?.unit_cost ?? 0,
    coefficient: a?.coefficient ?? 1,
    min_quantity: a?.min_quantity ?? null,
    storage_location_id: a?.storage_location_id ?? null,
    description: a?.description ?? '',
    is_active: a?.is_active ?? true,
    initial_quantity: null,
  })
  const [b, p, l] = await Promise.allSettled([api.brands.list(), api.providers.list({ per_page: 100 }), api.storageLocations.list()])
  brands.value = b.status === 'fulfilled' ? b.value : []
  providers.value = p.status === 'fulfilled' ? p.value.data : []
  locations.value = l.status === 'fulfilled' ? l.value : []
})

async function save(): Promise<void> {
  const text = (v: string) => v.trim() || null
  const payload: ArticlePayload = {
    designation: form.designation.trim(),
    reference: text(form.reference),
    barcode: text(form.barcode),
    category: form.category,
    unit: text(form.unit),
    brand_id: form.brand_id,
    provider_id: form.provider_id,
    min_quantity: form.min_quantity,
    storage_location_id: form.storage_location_id,
    description: text(form.description),
    is_active: form.is_active,
    ...(canCosts.value ? { unit_cost: form.unit_cost, coefficient: form.coefficient } : {}),
    ...(creating.value ? { initial_quantity: form.initial_quantity, client_uuid: crypto.randomUUID() } : {}),
  }
  saving.value = true
  errors.value = {}
  generalError.value = null
  try {
    const article = props.article
      ? await api.articles.update(props.article.id, payload)
      : await api.articles.create({ ...payload, designation: payload.designation ?? '' })
    visible.value = false
    emit('saved', article)
  } catch (e) {
    if (e instanceof ApiError) {
      errors.value = e.errors
      generalError.value = Object.keys(e.errors).length ? null : e.message
    } else {
      generalError.value = 'Enregistrement impossible. Réessayez.'
    }
  } finally {
    saving.value = false
  }
}

const fieldError = (f: string) => errors.value[f]?.[0]
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.article ? 'Modifier l\'article' : 'Nouvel article'" modal :style="{ width: '680px' }" :breakpoints="{ '720px': '95vw' }">
    <form id="article-form" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">{{ generalError }}</Message>
      <div class="form-field form-field--full">
        <label for="a-designation">Désignation</label>
        <InputText id="a-designation" v-model="form.designation" :invalid="!!fieldError('designation')" autofocus />
        <small v-if="fieldError('designation')" class="field-error">{{ fieldError('designation') }}</small>
      </div>
      <div class="form-field">
        <label for="a-reference">Référence</label>
        <InputText id="a-reference" v-model="form.reference" />
      </div>
      <div class="form-field">
        <label for="a-barcode">Code-barres</label>
        <InputText id="a-barcode" v-model="form.barcode" :invalid="!!fieldError('barcode')" />
        <small v-if="fieldError('barcode')" class="field-error">{{ fieldError('barcode') }}</small>
      </div>
      <div class="form-field">
        <label for="a-category">Catégorie (comme dans les devis)</label>
        <Select id="a-category" v-model="form.category" :options="categories" option-label="label" option-value="value" />
      </div>
      <div class="form-field">
        <label for="a-unit">Unité</label>
        <InputText id="a-unit" v-model="form.unit" placeholder="u, m, rouleau…" />
      </div>
      <div class="form-field">
        <label for="a-brand">Marque</label>
        <Select id="a-brand" v-model="form.brand_id" :options="[{ id: null, name: 'Aucune' }, ...brands]" option-label="name" option-value="id" filter />
      </div>
      <div class="form-field">
        <label for="a-provider">Fournisseur habituel</label>
        <Select id="a-provider" v-model="form.provider_id" :options="[{ id: null, name: 'Aucun' }, ...providers]" option-label="name" option-value="id" filter />
      </div>
      <template v-if="canCosts">
        <div class="form-field">
          <label for="a-cost">Coût d'achat</label>
          <InputNumber v-model="form.unit_cost" input-id="a-cost" :min="0" :max-fraction-digits="2" />
        </div>
        <div class="form-field">
          <label for="a-coef">Coefficient</label>
          <InputNumber v-model="form.coefficient" input-id="a-coef" :min="0" :max-fraction-digits="4" />
          <small class="muted">Prix de vente : {{ formatMoney(Math.round(form.unit_cost * form.coefficient)) }}</small>
        </div>
      </template>
      <div class="form-field">
        <label for="a-min">Seuil d'alerte</label>
        <InputNumber v-model="form.min_quantity" input-id="a-min" :min="0" :max-fraction-digits="2" placeholder="Aucun" />
      </div>
      <div class="form-field">
        <label for="a-location">Emplacement</label>
        <Select id="a-location" v-model="form.storage_location_id" :options="[{ id: null, name: 'Non rangé' }, ...locations]" option-label="name" option-value="id" filter />
        <small class="muted">Nouvel emplacement : Stock → Emplacements.</small>
      </div>
      <div v-if="creating" class="form-field">
        <label for="a-initial">Quantité en stock aujourd'hui</label>
        <InputNumber v-model="form.initial_quantity" input-id="a-initial" :min="0" :max-fraction-digits="2" placeholder="0" />
        <small class="muted">Enregistrée comme un inventaire ; ensuite, la quantité change par les mouvements.</small>
      </div>
      <div class="form-field form-field--full">
        <label for="a-description">Description</label>
        <MarkdownEditor id="a-description" v-model="form.description" rows="2" auto-resize />
      </div>
      <label v-if="!creating" class="form-field--full switch"><ToggleSwitch v-model="form.is_active" /> Article actif (proposé dans les devis et les achats)</label>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button :label="creating ? 'Créer l\'article' : 'Enregistrer'" icon="pi pi-check" type="submit" form="article-form" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
