<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { Document } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { documentUrl, openDocuments } from '@/utils/lightbox'

/** Photos d'une section de journal : vignettes, ajout (plusieurs à la fois), suppression. */
const props = defineProps<{ sectionId: number; photos: Document[]; canAdd: boolean; canManage: boolean }>()
const auth = useAuthStore()
const toast = useToast()
const list = ref<Document[]>([])
const urls = ref<Record<number, string>>({})
const busy = ref(false)
const input = ref<HTMLInputElement | null>(null)

const isImage = (d: Document) => (d.mime_type ?? '').startsWith('image/')
const canRemove = (d: Document) => props.canManage || (props.canAdd && d.creator?.id === auth.user?.id)

async function thumbnail(d: Document): Promise<void> {
  if (!isImage(d) || urls.value[d.id]) return
  try {
    urls.value = { ...urls.value, [d.id]: await documentUrl(d) }
  } catch {
    // vignette indisponible : le nom reste affiché
  }
}

watch(() => props.photos, (photos) => {
  list.value = [...photos]
  photos.forEach((d) => void thumbnail(d))
}, { immediate: true })


async function onFiles(event: Event): Promise<void> {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  busy.value = true
  try {
    for (const file of files) {
      const doc = await api.documents.upload('journal-sections', props.sectionId, file, file.name)
      list.value = [...list.value, doc]
      void thumbnail(doc)
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Envoi impossible', detail: e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message, life: 5000 })
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}

async function open(d: Document): Promise<void> {
  await openDocuments(list.value, d)
}

async function remove(d: Document): Promise<void> {
  try {
    await api.documents.remove(d.id)
    list.value = list.value.filter((x) => x.id !== d.id)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Suppression impossible', detail: (e as Error).message, life: 5000 })
  }
}
</script>

<template>
  <div v-if="list.length || canAdd" class="photos">
    <figure v-for="d in list" :key="d.id" class="photo">
      <button type="button" class="thumb" :title="d.name" @click="open(d)">
        <img v-if="urls[d.id]" :src="urls[d.id]" :alt="d.name" />
        <i v-else class="pi pi-image" />
      </button>
      <Button v-if="canRemove(d)" icon="pi pi-times" rounded size="small" severity="secondary" class="remove" aria-label="Retirer la photo" @click="remove(d)" />
    </figure>
    <template v-if="canAdd">
      <input ref="input" type="file" accept="image/*" multiple hidden @change="onFiles" />
      <button type="button" class="thumb add" :disabled="busy" @click="input?.click()">
        <i :class="busy ? 'pi pi-spin pi-spinner' : 'pi pi-camera'" />
        <span>Photos</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.photos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.photo {
  position: relative;
  margin: 0;
}

.thumb {
  width: 96px;
  height: 72px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  background: var(--p-content-hover-background);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  color: var(--p-text-muted-color);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.add {
  border-style: dashed;
  font-size: 0.8rem;
}

.remove {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  width: 1.5rem !important;
  height: 1.5rem !important;
}
</style>
