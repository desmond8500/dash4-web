<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { initials } from '@/utils/clients'

/** Logo du client, ou ses initiales s'il n'en a pas (ou si l'image ne se charge pas). */
const props = withDefaults(defineProps<{ name: string; url?: string | null; size?: number }>(), { size: 40 })

const broken = ref(false)
watch(
  () => props.url,
  () => (broken.value = false),
)

const style = computed(() => ({ width: `${props.size}px`, height: `${props.size}px`, fontSize: `${props.size * 0.38}px` }))
</script>

<template>
  <span class="client-logo" :style="style">
    <img v-if="props.url && !broken" :src="props.url" :alt="`Logo de ${props.name}`" @error="broken = true" />
    <span v-else aria-hidden="true">{{ initials(props.name) }}</span>
  </span>
</template>

<style scoped>
.client-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
  font-weight: 600;
  border: 1px solid var(--p-content-border-color);
}

.client-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}
</style>
