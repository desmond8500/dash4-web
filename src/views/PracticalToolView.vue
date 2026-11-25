<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from 'primevue/button'
import Select from 'primevue/select'
import AutoComplete, { type AutoCompleteCompleteEvent, type AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import { useToast } from 'primevue/usetoast'
import { practicalTool, type PracticalToolLink, type PracticalToolLinkType } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { apiErrorMessage } from '@/utils/errors'
import { LINK_TYPES, linkRoute } from '@/utils/practicalTools'
import GalaxyDimensionTool from '@/components/practicalTools/GalaxyDimensionTool.vue'

/** Un outil pratique : le calcul, puis les marques, fournisseurs et articles auxquels il est lié. */
const route = useRoute()
const toast = useToast()
const auth = useAuthStore()
const slug = computed(() => String(route.params.slug))
const tool = computed(() => practicalTool(slug.value))
const components: Record<string, unknown> = { 'galaxy-dimension-text': GalaxyDimensionTool }

const links = ref<PracticalToolLink[]>([])
const canLink = computed(() => auth.can('stock.update'))
const linkType = ref<PracticalToolLinkType>('brands')
const picked = ref<{ id: number; label: string } | string | null>(null)
const suggestions = ref<Array<{ id: number; label: string }>>([])

onMounted(load)
async function load(): Promise<void> {
  try {
    links.value = (await api.practicalTools.list()).find((t) => t.slug === slug.value)?.links ?? []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Liens indisponibles', detail: apiErrorMessage(e), life: 5000 })
  }
}

async function search(event: AutoCompleteCompleteEvent): Promise<void> {
  try {
    const q = event.query
    suggestions.value =
      linkType.value === 'brands' ? (await api.brands.list(q)).slice(0, 15).map((b) => ({ id: b.id, label: b.name }))
      : linkType.value === 'providers' ? (await api.providers.list({ search: q, per_page: 15 })).data.map((p) => ({ id: p.id, label: p.name }))
      : (await api.articles.list({ search: q, per_page: 15 })).data.map((a) => ({ id: a.id, label: a.reference ? `${a.designation} — ${a.reference}` : a.designation }))
  } catch {
    suggestions.value = []
  }
}

async function onSelect(event: AutoCompleteOptionSelectEvent): Promise<void> {
  const target = event.value as { id: number }
  try {
    const link = await api.practicalTools.link(slug.value, linkType.value, target.id)
    links.value = [...links.value.filter((l) => l.id !== link.id), link]
    picked.value = null
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lien impossible', detail: apiErrorMessage(e), life: 5000 })
  }
}

async function unlink(link: PracticalToolLink): Promise<void> {
  try {
    await api.practicalTools.unlink(link.id)
    links.value = links.value.filter((l) => l.id !== link.id)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Retrait impossible', detail: apiErrorMessage(e), life: 5000 })
  }
}
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'practical-tools' }" class="back"><i class="pi pi-arrow-left" /> Outils pratiques</RouterLink>
    <template v-if="tool">
      <div class="page-header">
        <h1>{{ tool.name }}</h1>
      </div>
      <p class="muted">{{ tool.description }}</p>

      <section class="tool-box">
        <component :is="components[tool.slug]" />
      </section>

      <section class="links">
        <h2>Lié à</h2>
        <p v-if="!links.length" class="muted">Aucune marque, aucun fournisseur ni article pour l'instant.</p>
        <div v-for="group in LINK_TYPES" :key="group.value" class="link-group">
          <template v-if="links.some((l) => l.type === group.value)">
            <span class="muted">{{ group.label }} :</span>
            <span v-for="l in links.filter((x) => x.type === group.value)" :key="l.id" class="chip">
              <RouterLink :to="linkRoute(l)">{{ l.target.name }}<small v-if="l.target.reference" class="muted"> — {{ l.target.reference }}</small></RouterLink>
              <Button v-if="canLink" icon="pi pi-times" text rounded size="small" severity="secondary" :aria-label="`Retirer ${l.target.name}`" @click="unlink(l)" />
            </span>
          </template>
        </div>

        <div v-if="canLink" class="add">
          <Select v-model="linkType" :options="LINK_TYPES" option-label="singular" option-value="value" aria-label="Type de fiche" />
          <AutoComplete
            v-model="picked"
            :suggestions="suggestions"
            option-label="label"
            :delay="250"
            :placeholder="`Chercher ${LINK_TYPES.find((t) => t.value === linkType)!.searchLabel}`"
            class="grow"
            @complete="search"
            @option-select="onSelect"
          />
        </div>
      </section>
    </template>
    <p v-else class="muted">Outil introuvable.</p>
  </div>
</template>

<style scoped>
.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}
.tool-box {
  padding: 1.25rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  background: var(--p-content-background);
  margin: 1rem 0 1.5rem;
}
.links h2 {
  font-size: 1.1rem;
  margin: 0 0 0.5rem;
}
.link-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.1rem 0.25rem 0.1rem 0.7rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
}
.add {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
  max-width: 40rem;
}
.grow {
  flex: 1 1 18rem;
}
</style>
