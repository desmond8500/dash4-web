<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { formatMoney } from '@dash4/shared'
import type { Currency, QuoteSection, QuoteSystem, QuoteTemplate, QuoteTemplateSummary } from '@dash4/shared'
import { api } from '@/services/api'

/** Choix d'un modèle à insérer : dans une nouvelle section à son nom, ou à la suite d'une section. */
const props = defineProps<{ sections: QuoteSection[]; currency: Currency; showPrices: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ insert: [templateId: number, sectionId: number | undefined] }>()

const systems = ref<QuoteSystem[]>([])
const loose = ref<QuoteTemplateSummary[]>([])
const selected = ref<number | null>(null)
const preview = ref<QuoteTemplate | null>(null)
const target = ref<number | null>(null)

watch(visible, async (open) => {
  if (!open) return
  selected.value = null
  preview.value = null
  target.value = null
  const catalog = await api.quoteTemplates.catalog()
  systems.value = catalog.systems
  loose.value = catalog.templates_without_system
})

watch(selected, async (id) => {
  preview.value = id ? await api.quoteTemplates.get(id) : null
})

const groups = computed(() => [
  ...systems.value.filter((s) => s.templates.length).map((s) => ({ label: s.name, items: s.templates })),
  ...(loose.value.length ? [{ label: 'Sans système', items: loose.value }] : []),
])
const targets = computed(() => [{ id: null, title: 'Nouvelle section au nom du modèle' }, ...props.sections])

function insert(): void {
  if (!selected.value) return
  emit('insert', selected.value, target.value ?? undefined)
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Insérer un modèle" modal :style="{ width: '640px' }" :breakpoints="{ '700px': '95vw' }">
    <div class="form-grid">
      <div class="form-field form-field--full">
        <label for="t-template">Modèle</label>
        <Select
          id="t-template"
          v-model="selected"
          :options="groups"
          option-group-label="label"
          option-group-children="items"
          option-label="name"
          option-value="id"
          filter
          placeholder="Choisir un modèle"
          empty-message="Aucun modèle : enregistrez une section comme modèle depuis un devis."
        />
      </div>
      <div class="form-field form-field--full">
        <label for="t-target">Où l'insérer</label>
        <Select id="t-target" v-model="target" :options="targets" option-label="title" option-value="id" />
      </div>
      <div v-if="preview" class="form-field form-field--full">
        <label>{{ preview.lines.length }} ligne(s)</label>
        <table class="list">
          <tbody>
            <tr v-for="(l, i) in preview.lines" :key="i">
              <td>{{ l.designation }}</td>
              <td class="muted">{{ l.category.label }}</td>
              <td class="num">{{ l.quantity }}{{ l.unit ? ` ${l.unit}` : '' }}</td>
              <td v-if="props.showPrices" class="num">{{ l.unit_price !== undefined ? formatMoney(l.unit_price, props.currency) : '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Insérer" icon="pi pi-plus" :disabled="!selected" @click="insert" />
    </template>
  </Dialog>
</template>
