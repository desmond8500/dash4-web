<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'

/**
 * Photo principale d'une fiche (véhicule, outil) : affichée en grand, changée d'un clic (ou par glisser-déposer)
 * quand on en a le droit. `upload` / `remove` appellent l'API et renvoient la fiche à jour.
 */
const props = withDefaults(
  defineProps<{
    url: string | null
    alt: string
    icon?: string
    canEdit?: boolean
    size?: string
    upload: (file: File) => Promise<unknown>
    remove: () => Promise<unknown>
  }>(),
  { icon: 'pi pi-image', canEdit: false, size: '160px' },
)
const toast = useToast()
const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const broken = ref(false)

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  try {
    await action()
    broken.value = false
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Photo non enregistrée', detail: e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message, life: 5000 })
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}
function onFile(file: File | undefined): void {
  if (file && file.type.startsWith('image/')) void run(() => props.upload(file))
}
</script>

<template>
  <div class="record-photo" :style="{ width: props.size, height: props.size }" @dragover.prevent @drop.prevent="props.canEdit && onFile($event.dataTransfer?.files[0])">
    <button
      type="button"
      class="frame"
      :disabled="!props.canEdit || busy"
      :aria-label="props.canEdit ? (props.url ? 'Changer la photo' : 'Ajouter une photo') : props.alt"
      @click="input?.click()"
    >
      <img v-if="props.url && !broken" :src="props.url" :alt="props.alt" @error="broken = true" />
      <span v-else class="empty"><i :class="props.icon" aria-hidden="true" /><small v-if="props.canEdit">Ajouter une photo</small></span>
      <span v-if="props.canEdit && props.url" class="overlay"><i :class="busy ? 'pi pi-spin pi-spinner' : 'pi pi-camera'" aria-hidden="true" /></span>
    </button>
    <Button v-if="props.canEdit && props.url" icon="pi pi-times" rounded size="small" severity="secondary" class="remove" aria-label="Retirer la photo" @click="run(props.remove)" />
    <input ref="input" type="file" accept="image/*" hidden @change="onFile(($event.target as HTMLInputElement).files?.[0])" />
  </div>
</template>

<style scoped>
.record-photo {
  position: relative;
  flex: none;
}
.frame {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: 14px;
  overflow: hidden;
  background: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
  cursor: pointer;
  position: relative;
}
.frame:disabled {
  cursor: default;
}
.frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 100%;
}
.empty i {
  font-size: 2.25rem;
  color: var(--p-primary-color);
}
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.4);
  color: #fff;
  font-size: 1.5rem;
  opacity: 0;
  transition: opacity 0.15s;
}
.frame:hover .overlay,
.frame:focus-visible .overlay {
  opacity: 1;
}
.remove {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
}
</style>
