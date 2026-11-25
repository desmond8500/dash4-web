import { ref, watch, type Ref } from 'vue'

export type ViewMode = 'table' | 'cards'

/** Lit le mode d'affichage gardé pour une liste (tableau par défaut). */
export function readViewMode(key: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): ViewMode {
  try {
    return storage?.getItem(`dash4.view.${key}`) === 'cards' ? 'cards' : 'table'
  } catch {
    return 'table'
  }
}

/** Mode d'affichage d'une liste (« tableau » ou « cartes »), gardé dans le navigateur pour la prochaine visite. */
export function useViewMode(key: string): Ref<ViewMode> {
  const mode = ref<ViewMode>(readViewMode(key))
  watch(mode, (value) => {
    try {
      safeStorage()?.setItem(`dash4.view.${key}`, value)
    } catch {
      // stockage indisponible : le choix ne sera pas gardé
    }
  })
  return mode
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
