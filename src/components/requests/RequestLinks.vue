<script setup lang="ts">
import { ref, watch } from 'vue'
import Select from 'primevue/select'
import AutoComplete, { type AutoCompleteCompleteEvent, type AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError, CLIENT_REQUEST_LINK_TYPES } from '@dash4/shared'
import type { ClientRequest, ClientRequestLink, ClientRequestLinkType } from '@dash4/shared'
import { api } from '@/services/api'
import { linkRoute } from '@/utils/clientRequests'

/** Tâches, factures, bordereaux, devis et projets liés à une demande. */
const props = defineProps<{ request: ClientRequest; canEdit: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const toast = useToast()

const links = ref<ClientRequestLink[]>(props.request.links ?? [])
watch(() => props.request, (r) => (links.value = r.links ?? []))
const type = ref<ClientRequestLinkType>('task')
const value = ref<{ id: number; label: string } | string | null>(null)
const suggestions = ref<Array<{ id: number; label: string }>>([])

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function search(event: AutoCompleteCompleteEvent): Promise<void> {
  suggestions.value = await api.clientRequestLinks.candidates(type.value, event.query).catch(() => [])
}
async function add(event: AutoCompleteOptionSelectEvent): Promise<void> {
  const target = event.value as { id: number }
  value.value = null
  try {
    links.value = (await api.clientRequestLinks.add(props.request.id, type.value, target.id)).links ?? []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lien impossible', detail: errorDetail(e), life: 5000 })
  }
}
async function remove(link: ClientRequestLink): Promise<void> {
  links.value = (await api.clientRequestLinks.remove(link.id)).links ?? []
}
</script>

<template>
  <div class="links">
    <label>Lié à</label>
    <ul v-if="links.length">
      <li v-for="l in links" :key="l.id">
        <span class="muted type">{{ l.type_label }}</span>
        <RouterLink :to="linkRoute(l)" @click="emit('navigate')">{{ l.label }}</RouterLink>
        <Button v-if="props.canEdit" icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Retirer le lien" @click="remove(l)" />
      </li>
    </ul>
    <p v-else class="muted small">Rien pour l'instant.</p>
    <div v-if="props.canEdit" class="add">
      <Select v-model="type" :options="CLIENT_REQUEST_LINK_TYPES" option-label="label" option-value="value" class="type-select" />
      <AutoComplete v-model="value" :suggestions="suggestions" option-label="label" placeholder="Chercher par numéro ou titre" :delay="250" class="grow" @complete="search" @option-select="add" />
    </div>
  </div>
</template>

<style scoped>
.links ul {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0;
}

.links li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type {
  min-width: 5.5rem;
  font-size: 0.85rem;
}

.add {
  display: flex;
  gap: 0.5rem;
}

.type-select {
  width: 9rem;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.85rem;
}
</style>
