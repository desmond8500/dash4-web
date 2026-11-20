<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { StorageLocation } from '@dash4/shared'
import { api } from '@/services/api'
import ArticleList from '@/components/stock/ArticleList.vue'
import { formatQty } from '@/utils/stock'

/** Un emplacement : ce qui y est rangé. */
const props = defineProps<{ id: string }>()
const toast = useToast()
const router = useRouter()
const location = ref<StorageLocation | null>(null)
const form = ref({ name: '', code: '', description: '' })
const loading = ref(true)

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
function set(l: StorageLocation): void {
  location.value = l
  form.value = { name: l.name, code: l.code ?? '', description: l.description ?? '' }
}
async function load(): Promise<void> {
  loading.value = true
  try {
    set(await api.storageLocations.get(Number(props.id)))
  } catch {
    location.value = null
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

async function save(payload: Parameters<typeof api.storageLocations.update>[1]): Promise<void> {
  try {
    set(await api.storageLocations.update(location.value!.id, payload))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
    set(location.value!)
  }
}
async function remove(): Promise<void> {
  try {
    await api.storageLocations.remove(location.value!.id)
    void router.push({ name: 'storage-locations' })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Suppression impossible', detail: errorDetail(e), life: 5000 })
  }
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !location" class="center"><ProgressSpinner /></div>
    <div v-else-if="!location" class="center">
      <p>Cet emplacement n'existe pas ou a été supprimé.</p>
      <RouterLink :to="{ name: 'storage-locations' }">Retour aux emplacements</RouterLink>
    </div>
    <template v-else>
      <RouterLink :to="{ name: 'storage-locations' }" class="back"><i class="pi pi-arrow-left" /> Emplacements</RouterLink>
      <div class="page-header">
        <h1><i class="pi pi-map-marker" /> {{ location.name }}</h1>
        <Button v-if="location.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" :disabled="location.articles_count > 0" :title="location.articles_count ? 'Des articles sont rangés ici' : ''" @click="remove" />
      </div>
      <Card>
        <template #content>
          <div class="form-grid">
            <div class="form-field"><label for="l-name">Nom</label><InputText id="l-name" v-model="form.name" :disabled="!location.can.update" @change="form.name.trim() && save({ name: form.name.trim() })" /></div>
            <div class="form-field"><label for="l-code">Code</label><InputText id="l-code" v-model="form.code" :disabled="!location.can.update" @change="save({ code: form.code.trim() || null })" /></div>
            <div class="form-field form-field--full"><label for="l-desc">Description</label><Textarea id="l-desc" v-model="form.description" rows="2" auto-resize :disabled="!location.can.update" @change="save({ description: form.description.trim() || null })" /></div>
            <label v-if="location.can.update" class="switch"><ToggleSwitch :model-value="location.is_active" @update:model-value="(v: boolean) => save({ is_active: v })" /> Emplacement actif</label>
          </div>
          <p class="muted">{{ location.articles_count }} article(s) · {{ formatQty(location.units) }} pièce(s) rangée(s)</p>
        </template>
      </Card>
      <h2>Rangé ici</h2>
      <ArticleList :filters="{ storage_location_id: location.id }" />
    </template>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
