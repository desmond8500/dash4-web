<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import type { ViewMode } from '@/composables/useViewMode'

/** Bascule entre l'affichage en tableau et en cartes. */
const mode = defineModel<ViewMode>({ required: true })
const options = [
  { value: 'table', icon: 'pi pi-list', label: 'Tableau' },
  { value: 'cards', icon: 'pi pi-th-large', label: 'Cartes' },
]
</script>

<template>
  <SelectButton v-model="mode" :options="options" option-value="value" data-key="value" :allow-empty="false" aria-label="Affichage">
    <template #option="{ option }">
      <i :class="option.icon" :title="option.label" />
      <span class="sr-only">{{ option.label }}</span>
    </template>
  </SelectButton>
</template>
