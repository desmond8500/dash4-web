<script setup lang="ts">
import { ref } from 'vue'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import { api } from '@/services/api'

/**
 * Sélecteur générique d'un client (tiers) par nom, avec recherche au fil de la frappe.
 * `v-model` porte `{ id, name } | null` — à relier directement à `client_id` à l'enregistrement.
 * Reprend l'AutoComplete dupliqué dans les devis, factures et projets.
 */
export interface ClientOption {
  id: number
  name: string
}

const props = defineProps<{ inputId?: string; placeholder?: string; invalid?: boolean; disabled?: boolean }>()
const model = defineModel<ClientOption | null>({ default: null })
const suggestions = ref<ClientOption[]>([])

async function search(event: AutoCompleteCompleteEvent): Promise<void> {
  try {
    suggestions.value = (await api.clients.list({ search: event.query, per_page: 10 })).data.map((c) => ({ id: c.id, name: c.name }))
  } catch {
    suggestions.value = []
  }
}
</script>

<template>
  <AutoComplete
    v-model="model"
    :input-id="props.inputId"
    :suggestions="suggestions"
    option-label="name"
    :placeholder="props.placeholder ?? 'Rechercher un client'"
    force-selection
    dropdown
    :delay="250"
    :invalid="props.invalid"
    :disabled="props.disabled"
    @complete="search"
  />
</template>
