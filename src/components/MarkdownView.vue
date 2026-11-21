<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@dash4/shared'

/** Affiche un texte Markdown (rendu sûr : le HTML saisi n'est jamais interprété). */
const props = defineProps<{ text: string | null | undefined; mentions?: string[] }>()
const html = computed(() => renderMarkdown(props.text, { mentions: props.mentions }))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- HTML produit par renderMarkdown, qui échappe tout le texte saisi -->
  <div v-if="html" class="md" v-html="html" />
</template>
