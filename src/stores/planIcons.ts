import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlanIcon } from '@dash4/shared'
import { api } from '@/services/api'

/**
 * Bibliothèque d'icônes des plans, chargée une fois. Les images envoyées se téléchargent avec le jeton et
 * restent en mémoire (adresse `blob:` pour l'affichage, image décodée pour dessiner l'aperçu des PDF).
 */
export const usePlanIconsStore = defineStore('planIcons', () => {
  const icons = ref<PlanIcon[]>([])
  const urls = ref<Record<number, string>>({})
  const images = new Map<number, HTMLImageElement>()
  let loading: Promise<void> | null = null

  async function load(force = false): Promise<void> {
    if (loading && !force) return loading
    loading = (async () => {
      icons.value = await api.planIcons.list().catch(() => [])
      await Promise.all(icons.value.filter((i) => i.file_path).map((i) => fetchImage(i)))
    })()
    return loading
  }

  async function fetchImage(icon: PlanIcon): Promise<void> {
    const stamp = `${icon.id}:${icon.updated_at}`
    if (urls.value[icon.id] && images.get(icon.id)?.dataset.stamp === stamp) return
    try {
      const blob = await api.planIcons.file(icon)
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.dataset.stamp = stamp
      img.src = url
      await img.decode().catch(() => undefined)
      if (urls.value[icon.id]) URL.revokeObjectURL(urls.value[icon.id]!)
      urls.value = { ...urls.value, [icon.id]: url }
      images.set(icon.id, img)
    } catch {
      // Image absente : l'icône s'affiche avec le symbole par défaut
    }
  }

  const byId = (id: number | null | undefined) => (id ? icons.value.find((i) => i.id === id) ?? null : null)

  function upsert(icon: PlanIcon): void {
    icons.value = icons.value.some((i) => i.id === icon.id) ? icons.value.map((i) => (i.id === icon.id ? icon : i)) : [...icons.value, icon]
    if (icon.file_path) void fetchImage(icon)
  }

  function removeLocal(id: number): void {
    icons.value = icons.value.filter((i) => i.id !== id)
  }

  return { icons, urls, images, load, byId, upsert, removeLocal }
})
