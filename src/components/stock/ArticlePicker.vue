<script setup lang="ts">
import { ref } from 'vue'
import AutoComplete, { type AutoCompleteCompleteEvent, type AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import type { Article } from '@dash4/shared'
import { api } from '@/services/api'
import { formatQty } from '@/utils/stock'

/** Recherche d'un article du stock (désignation, référence, code-barres, marque). Vidé après le choix. */
const props = defineProps<{ placeholder?: string; inputId?: string }>()
const emit = defineEmits<{ select: [article: Article] }>()

const value = ref<Article | string | null>(null)
const suggestions = ref<Article[]>([])

async function search(event: AutoCompleteCompleteEvent): Promise<void> {
  try {
    suggestions.value = (await api.articles.list({ search: event.query, per_page: 15 })).data
  } catch {
    suggestions.value = []
  }
}

function onSelect(event: AutoCompleteOptionSelectEvent): void {
  emit('select', event.value as Article)
  value.value = null
}
</script>

<template>
  <AutoComplete
    v-model="value"
    :input-id="props.inputId"
    :suggestions="suggestions"
    option-label="designation"
    :placeholder="props.placeholder ?? 'Chercher un article du stock'"
    :delay="250"
    fluid
    @complete="search"
    @option-select="onSelect"
  >
    <template #option="{ option }">
      <div class="option">
        <span>
          {{ option.designation }}
          <span v-if="option.reference" class="muted"> · {{ option.reference }}</span>
          <span v-if="option.brand" class="muted"> · {{ option.brand.name }}</span>
        </span>
        <span class="stock" :class="{ low: option.is_low || option.quantity <= 0 }">{{ formatQty(option.quantity) }} {{ option.unit ?? '' }}</span>
      </div>
    </template>
    <template #empty>Aucun article trouvé.</template>
  </AutoComplete>
</template>

<style scoped>
.option {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.stock {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.stock.low {
  color: var(--p-red-500);
  font-weight: 600;
}
</style>
