<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import ClientLogo from '@/components/ClientLogo.vue'

/** Logo avec boutons Changer / Retirer (JPEG, PNG, WebP, 2 Mo). */
const props = defineProps<{ name: string; url: string | null; canEdit: boolean; size?: number }>()
const emit = defineEmits<{ upload: [file: File]; remove: [] }>()
const input = ref<HTMLInputElement | null>(null)

function picked(event: Event): void {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (file) emit('upload', file)
}
</script>

<template>
  <div class="logo-editor">
    <ClientLogo :name="props.name" :url="props.url" :size="props.size ?? 96" />
    <div v-if="props.canEdit" class="buttons">
      <Button :label="props.url ? 'Changer' : 'Ajouter un logo'" size="small" text @click="input?.click()" />
      <Button v-if="props.url" label="Retirer" size="small" text severity="danger" @click="emit('remove')" />
      <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="picked" />
    </div>
  </div>
</template>

<style scoped>
.logo-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
