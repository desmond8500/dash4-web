<script setup lang="ts">
import { computed, useId } from 'vue'
import { codeFontSize, planSymbol, type PlanIcon } from '@dash4/shared'
import { usePlanIconsStore } from '@/stores/planIcons'

/**
 * Icône d'un repère : symbole intégré colorié (avec son code — DOF, NC2… — et sa seconde couleur en bas),
 * ou image de la bibliothèque. Remplit son parent.
 */
const props = defineProps<{ icon: PlanIcon | null; color: string; symbol?: string | null }>()
const store = usePlanIconsStore()
const clip = `glyph-${useId()}`
const url = computed(() => (props.icon?.file_path ? store.urls[props.icon.id] : undefined))
const symbolKey = computed(() => props.symbol ?? props.icon?.symbol)
const path = computed(() => planSymbol(symbolKey.value).path)
const code = computed(() => props.icon?.code?.trim() || null)
const fontSize = computed(() => codeFontSize(code.value, symbolKey.value))
</script>

<template>
  <img v-if="url" :src="url" alt="" class="glyph" draggable="false" />
  <svg v-else class="glyph" viewBox="-1 -1 26 26" aria-hidden="true">
    <path :d="path" fill-rule="evenodd" :fill="props.color" stroke="#fff" stroke-width="1.4" paint-order="stroke" stroke-linejoin="round" />
    <template v-if="props.icon?.secondary_color">
      <clipPath :id="clip"><rect x="-1" y="12" width="26" height="13" /></clipPath>
      <path :d="path" fill-rule="evenodd" :fill="props.icon.secondary_color" :clip-path="`url(#${clip})`" />
    </template>
    <text
      v-if="code"
      x="12"
      :y="12 + fontSize * 0.36"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-weight="700"
      :font-size="fontSize"
      :fill="props.icon?.text_color ?? '#ffffff'"
    >{{ code }}</text>
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
