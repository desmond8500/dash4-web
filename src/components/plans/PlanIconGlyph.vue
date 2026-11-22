<script setup lang="ts">
import { computed } from 'vue'
import { planSymbol, type PlanIcon } from '@dash4/shared'
import { usePlanIconsStore } from '@/stores/planIcons'

/** Icône d'un repère : symbole intégré colorié, ou image de la bibliothèque. Remplit son parent. */
const props = defineProps<{ icon: PlanIcon | null; color: string; symbol?: string | null }>()
const store = usePlanIconsStore()
const url = computed(() => (props.icon?.file_path ? store.urls[props.icon.id] : undefined))
const path = computed(() => planSymbol(props.symbol ?? props.icon?.symbol).path)
</script>

<template>
  <img v-if="url" :src="url" alt="" class="glyph" draggable="false" />
  <svg v-else class="glyph" viewBox="-1 -1 26 26" aria-hidden="true">
    <path :d="path" fill-rule="evenodd" :fill="props.color" stroke="#fff" stroke-width="1.4" paint-order="stroke" stroke-linejoin="round" />
  </svg>
</template>

<style scoped>
.glyph {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
</style>
