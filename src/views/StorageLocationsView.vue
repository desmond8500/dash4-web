<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { StorageLocation } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatQty } from '@/utils/stock'

/** Emplacements du magasin, avec ce qui y est rangé. */
const auth = useAuthStore()
const toast = useToast()
const router = useRouter()
const locations = ref<StorageLocation[]>([])
const form = ref({ name: '', code: '' })
const search = ref('')

const load = async () => (locations.value = await api.storageLocations.list(true).catch(() => []))
onMounted(load)

async function create(): Promise<void> {
  try {
    const location = await api.storageLocations.create({ name: form.value.name.trim(), code: form.value.code.trim() || null })
    form.value = { name: '', code: '' }
    void router.push({ name: 'storage-location', params: { id: location.id } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Emplacement refusé', detail: e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : undefined, life: 5000 })
  }
}

const filtered = () => {
  const term = search.value.trim().toLowerCase()
  return locations.value.filter((l) => !term || l.name.toLowerCase().includes(term) || l.code?.toLowerCase().includes(term))
}
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'stock' }" class="back"><i class="pi pi-arrow-left" /> Stock</RouterLink>
    <div class="page-header">
      <h1>Emplacements</h1>
      <form v-if="auth.can('stock.create')" class="add" @submit.prevent="create">
        <InputText v-model="form.name" placeholder="Nouvel emplacement (étagère A, rayon 2…)" class="name" />
        <InputText v-model="form.code" placeholder="Code (facultatif)" class="code" />
        <Button type="submit" label="Ajouter" icon="pi pi-plus" :disabled="!form.name.trim()" />
      </form>
    </div>
    <InputText v-model="search" placeholder="Chercher un emplacement" class="search" />

    <div v-if="filtered().length" class="cards">
      <button v-for="l in filtered()" :key="l.id" type="button" class="card" :class="{ inactive: !l.is_active }" @click="router.push({ name: 'storage-location', params: { id: l.id } })">
        <span class="title"><i class="pi pi-map-marker" /> {{ l.name }}<span v-if="l.code" class="muted"> · {{ l.code }}</span></span>
        <strong>{{ l.articles_count }} article(s)</strong>
        <small class="muted">{{ formatQty(l.units) }} pièce(s) rangée(s)<template v-if="!l.is_active"> · inactif</template></small>
      </button>
    </div>
    <p v-else class="muted">Aucun emplacement. Ajoutez vos étagères, rayons, armoires ou véhicules, puis rangez-y les articles depuis leur fiche.</p>
  </div>
</template>

<style scoped>
.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.add {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.name {
  min-width: 18rem;
}

.code {
  width: 10rem;
}

.search {
  max-width: 24rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  background: var(--p-content-background);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.card.inactive {
  opacity: 0.6;
}

.title {
  font-weight: 600;
}
</style>
