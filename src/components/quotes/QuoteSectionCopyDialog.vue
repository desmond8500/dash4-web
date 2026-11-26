<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import { useToast } from 'primevue/usetoast'
import type { Quote, QuoteSection, QuoteSectionCopy } from '@dash4/shared'
import { api } from '@/services/api'
import { apiErrorMessage } from '@/utils/errors'

/**
 * Copier une section et son contenu dans un ou plusieurs autres devis (brouillons ou envoyés : seuls ceux
 * que l'on peut encore modifier) ; la section arrive à la fin de chacun, sous le même titre.
 */
const props = defineProps<{ section: QuoteSection | null; quoteId: number }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ copied: [copies: QuoteSectionCopy[]] }>()
const toast = useToast()

const targets = ref<Quote[]>([])
const suggestions = ref<Quote[]>([])
const saving = ref(false)
watch(visible, (open) => {
  if (open) targets.value = []
})

const label = (q: Quote) => `${q.number} — ${q.title}${q.client ? ` (${q.client.name})` : ''}`

async function search(event: AutoCompleteCompleteEvent): Promise<void> {
  try {
    const chosen = new Set(targets.value.map((q) => q.id))
    suggestions.value = (await api.quotes.list({ search: event.query, status: 'draft,sent', per_page: 15 })).data
      .filter((q) => q.id !== props.quoteId && !chosen.has(q.id) && q.can?.update !== false)
  } catch {
    suggestions.value = []
  }
}

async function copy(): Promise<void> {
  if (!props.section || !targets.value.length) return
  saving.value = true
  try {
    const { copiedTo } = await api.quotes.duplicateSection(props.section.id, targets.value.map((q) => q.id))
    emit('copied', copiedTo)
    visible.value = false
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Copie impossible', detail: apiErrorMessage(e), life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="`Copier « ${props.section?.title ?? ''} » dans d'autres devis`" :style="{ width: '40rem' }" :breakpoints="{ '680px': '96vw' }">
    <p class="muted">
      La section et ses {{ props.section?.lines.length ?? 0 }} ligne(s) (articles, coûts, coefficients, commentaires, texte de la proposition technique)
      sont ajoutées à la fin de chaque devis choisi. Seuls les devis en brouillon ou envoyés peuvent la recevoir.
    </p>
    <label for="copy-targets" class="field-label">Devis de destination</label>
    <AutoComplete
      v-model="targets"
      input-id="copy-targets"
      multiple
      fluid
      :suggestions="suggestions"
      :option-label="label"
      :delay="250"
      placeholder="Chercher un devis (numéro, objet, client)…"
      @complete="search"
    />
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button :label="targets.length > 1 ? `Copier dans ${targets.length} devis` : 'Copier'" icon="pi pi-copy" :loading="saving" :disabled="!targets.length" @click="copy" />
    </template>
  </Dialog>
</template>

<style scoped>
.field-label {
  display: block;
  font-weight: 600;
  margin: 0.75rem 0 0.35rem;
}
</style>
