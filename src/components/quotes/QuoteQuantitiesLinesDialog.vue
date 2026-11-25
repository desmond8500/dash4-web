<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import type { Quote } from '@dash4/shared'
import { api } from '@/services/api'
import { apiErrorMessage } from '@/utils/errors'
import { quantitiesSections } from '@/utils/quotes'

/**
 * Choix des lignes reprises dans le quantitatif (PDF et tableur), section par section.
 * Les forfaits et la main-d'œuvre n'y sont jamais : ils ne sont pas proposés. Possible même sur un devis accepté.
 */
const props = defineProps<{ quote: Quote }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [quote: Quote] }>()
const toast = useToast()

const sections = computed(() => quantitiesSections(props.quote.sections ?? []))
const shown = ref(new Set<number>())
const saving = ref(false)

watch(visible, (open) => {
  if (open) shown.value = new Set(sections.value.flatMap((s) => s.lines.filter((l) => l.show_in_quantities !== false).map((l) => l.id)))
})

function toggle(id: number, on: boolean): void {
  const next = new Set(shown.value)
  if (on) next.add(id)
  else next.delete(id)
  shown.value = next
}

function setSection(ids: number[], on: boolean): void {
  const next = new Set(shown.value)
  ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
  shown.value = next
}

const allIds = computed(() => sections.value.flatMap((s) => s.lines.map((l) => l.id)))
const hiddenCount = computed(() => allIds.value.filter((id) => !shown.value.has(id)).length)

async function save(): Promise<void> {
  saving.value = true
  try {
    emit('saved', await api.quotes.setQuantitiesLines(props.quote.id, allIds.value.filter((id) => !shown.value.has(id))))
    visible.value = false
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Choix non enregistré', detail: apiErrorMessage(e), life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Lignes du quantitatif" :style="{ width: '44rem' }" :breakpoints="{ '760px': '96vw' }">
    <p class="muted">
      Cochez ce qui doit apparaître dans le quantitatif. Les forfaits et la main-d'œuvre n'y sont jamais.
      Ce choix est gardé sur le devis, même accepté, et repris à la duplication.
    </p>

    <p v-if="!sections.length" class="muted">Aucune ligne de matériel dans ce devis.</p>

    <section v-for="section in sections" :key="section.id" class="block">
      <header>
        <strong>{{ section.title }}</strong>
        <span v-if="!section.is_visible" class="muted"> (section masquée : seulement dans son propre quantitatif)</span>
        <span class="spacer" />
        <Button label="Tout" text size="small" @click="setSection(section.lines.map((l) => l.id), true)" />
        <Button label="Rien" text size="small" severity="secondary" @click="setSection(section.lines.map((l) => l.id), false)" />
      </header>
      <label v-for="line in section.lines" :key="line.id" class="line">
        <Checkbox :model-value="shown.has(line.id)" binary :input-id="`q-line-${line.id}`" @update:model-value="(v: boolean) => toggle(line.id, v)" />
        <span class="designation">{{ line.designation }}<small v-if="line.reference" class="muted"> — {{ line.reference }}</small></span>
        <span class="muted category">{{ line.category.label }}</span>
        <span class="qty">{{ line.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }} {{ line.unit ?? '' }}</span>
      </label>
    </section>

    <template #footer>
      <span class="muted footer-note">{{ hiddenCount ? `${hiddenCount} ligne(s) retirée(s)` : 'Toutes les lignes de matériel' }}</span>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" :loading="saving" :disabled="!sections.length" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.block {
  margin-bottom: 1rem;
}
.block header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border-bottom: 1px solid var(--p-content-border-color);
  padding-bottom: 0.25rem;
  margin-bottom: 0.25rem;
}
.spacer {
  flex: 1;
}
.line {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0;
  cursor: pointer;
}
.designation {
  flex: 1;
  min-width: 0;
}
.category {
  font-size: 0.8rem;
}
.qty {
  min-width: 5rem;
  text-align: right;
}
.footer-note {
  margin-right: auto;
}
</style>
