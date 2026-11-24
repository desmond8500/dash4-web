<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { AttachableType, Document } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { documentUrl, isImageDocument, openDocuments } from '@/utils/lightbox'
import { formatDate } from '@/utils/projects'

/**
 * Galerie de photos d'une fiche (documents image) : grandes vignettes, visionneuse plein écran,
 * ajout de plusieurs photos à la fois (ou glisser-déposer), suppression de ses photos.
 */
const props = defineProps<{ type: AttachableType; id: number; canAdd: boolean; canManage: boolean }>()
const emit = defineEmits<{ changed: [count: number] }>()
const auth = useAuthStore()
const toast = useToast()

const photos = ref<Document[]>([])
const urls = ref<Record<number, string>>({})
const loading = ref(true)
const busy = ref(false)
const dragging = ref(false)
const input = ref<HTMLInputElement | null>(null)
const canRemove = (d: Document) => props.canManage || (props.canAdd && d.creator?.id === auth.user?.id)

function thumbnail(d: Document): void {
  if (urls.value[d.id]) return
  void documentUrl(d).then((u) => (urls.value = { ...urls.value, [d.id]: u })).catch(() => undefined)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    photos.value = (await api.documents.list(props.type, props.id)).filter(isImageDocument)
    photos.value.forEach(thumbnail)
    emit('changed', photos.value.length)
  } catch {
    photos.value = []
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => [props.type, props.id], load)

async function upload(files: File[]): Promise<void> {
  const images = files.filter((f) => f.type.startsWith('image/'))
  if (!images.length) return
  busy.value = true
  try {
    for (const file of images) {
      const doc = await api.documents.upload(props.type, props.id, file, file.name)
      photos.value = [doc, ...photos.value]
      thumbnail(doc)
    }
    emit('changed', photos.value.length)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Envoi impossible', detail: e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message, life: 5000 })
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}

function onDrop(e: DragEvent): void {
  dragging.value = false
  if (props.canAdd) void upload(Array.from(e.dataTransfer?.files ?? []))
}

async function remove(d: Document): Promise<void> {
  try {
    await api.documents.remove(d.id)
    photos.value = photos.value.filter((x) => x.id !== d.id)
    emit('changed', photos.value.length)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Suppression impossible', detail: (e as Error).message, life: 5000 })
  }
}
</script>

<template>
  <div
    class="gallery"
    :class="{ dragging }"
    @dragover.prevent="props.canAdd && (dragging = true)"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <button v-if="props.canAdd" type="button" class="tile add" :disabled="busy" @click="input?.click()">
      <i :class="busy ? 'pi pi-spin pi-spinner' : 'pi pi-camera'" aria-hidden="true" />
      <span>Ajouter des photos</span>
      <small class="muted">ou glissez-les ici</small>
    </button>
    <input ref="input" type="file" accept="image/*" multiple hidden @change="(e) => upload(Array.from((e.target as HTMLInputElement).files ?? []))" />
    <figure v-for="d in photos" :key="d.id" class="tile">
      <button type="button" class="open" :aria-label="`Agrandir ${d.name}`" @click="openDocuments(photos, d)">
        <img v-if="urls[d.id]" :src="urls[d.id]" :alt="d.name" loading="lazy" />
        <i v-else class="pi pi-image" aria-hidden="true" />
      </button>
      <figcaption class="muted">{{ [formatDate(d.created_at), d.creator?.full_name].filter(Boolean).join(' · ') }}</figcaption>
      <Button v-if="canRemove(d)" icon="pi pi-trash" rounded size="small" severity="danger" class="remove" aria-label="Supprimer la photo" @click="remove(d)" />
    </figure>
    <p v-if="!loading && !photos.length && !props.canAdd" class="muted">Aucune photo.</p>
  </div>
</template>

<style scoped>
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
  border-radius: 10px;
  transition: background 0.15s;
}
.gallery.dragging {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  outline: 2px dashed var(--p-primary-color);
}
.tile {
  position: relative;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.open,
.add {
  aspect-ratio: 4 / 3;
  width: 100%;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  background: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, box-shadow 0.15s;
}
.open:hover,
.open:focus-visible,
.add:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.15);
}
.open img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.open i {
  font-size: 2rem;
}
.add {
  flex-direction: column;
  gap: 0.25rem;
  border-style: dashed;
}
.add i {
  font-size: 1.75rem;
  color: var(--p-primary-color);
}
figcaption {
  font-size: 0.75rem;
}
.remove {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
}
@media (prefers-reduced-motion: reduce) {
  .open,
  .add {
    transition: none;
  }
  .open:hover,
  .add:hover {
    transform: none;
  }
}
</style>
