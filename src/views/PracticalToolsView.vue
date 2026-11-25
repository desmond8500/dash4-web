<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { PRACTICAL_TOOLS, type PracticalToolInfo } from '@dash4/shared'
import { api } from '@/services/api'
import { apiErrorMessage } from '@/utils/errors'
import CardGrid from '@/components/CardGrid.vue'

/** Outils pratiques : calculs et conversions, avec les marques, fournisseurs et articles liés. */
const router = useRouter()
const toast = useToast()
const infos = ref<Record<string, PracticalToolInfo>>({})
const tools = PRACTICAL_TOOLS.map((t) => ({ ...t, id: t.slug }))

onMounted(async () => {
  try {
    infos.value = Object.fromEntries((await api.practicalTools.list()).map((t) => [t.slug, t]))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Liens indisponibles', detail: apiErrorMessage(e), life: 5000 })
  }
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Outils pratiques</h1>
    </div>
    <p class="muted">Calculs et conversions pour le terrain. Chaque outil peut être lié à des marques, fournisseurs ou articles.</p>

    <CardGrid :items="tools" min-width="20rem" @open="(t) => router.push({ name: 'practical-tool', params: { slug: t.slug } })">
      <template #card="{ item }">
        <div class="card-head">
          <span class="tool-icon"><i :class="item.icon" /></span>
          <div>
            <span class="card-title">{{ item.name }}</span>
          </div>
        </div>
        <div class="card-text">{{ item.description }}</div>
        <div class="card-foot">
          <Tag v-for="l in (infos[item.slug]?.links ?? []).slice(0, 4)" :key="l.id" :value="l.target.name" severity="secondary" />
          <span v-if="(infos[item.slug]?.links.length ?? 0) > 4" class="muted">+{{ infos[item.slug]!.links.length - 4 }}</span>
        </div>
      </template>
    </CardGrid>
  </div>
</template>

<style scoped>
.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 10px;
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
  font-size: 1.3rem;
}
</style>
