<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { PracticalToolLinkType, RecordPracticalTool } from '@dash4/shared'
import { api } from '@/services/api'

/** Outils pratiques liés à une marque, un fournisseur ou un article (rien s'il n'y en a pas). */
const props = defineProps<{ type: PracticalToolLinkType; id: number }>()
const tools = ref<RecordPracticalTool[]>([])

async function load(): Promise<void> {
  try {
    tools.value = await api.practicalTools.forRecord(props.type, props.id)
  } catch {
    tools.value = [] // bloc facultatif
  }
}
onMounted(load)
watch(() => props.id, load)
</script>

<template>
  <div v-if="tools.length" class="record-tools">
    <i class="pi pi-calculator" aria-hidden="true" />
    <span class="muted">Outils pratiques :</span>
    <RouterLink v-for="t in tools" :key="t.id" :to="{ name: 'practical-tool', params: { slug: t.tool } }" class="tool-link">{{ t.name }}</RouterLink>
  </div>
</template>

<style scoped>
.record-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 1rem;
  padding: 0.5rem 0.85rem;
  border-radius: 10px;
  background: var(--p-highlight-background);
}
.record-tools > i {
  color: var(--p-highlight-color);
}
.tool-link {
  font-weight: 600;
}
</style>
