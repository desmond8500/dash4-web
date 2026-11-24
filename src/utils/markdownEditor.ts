import { ref } from 'vue'

/** Aperçu « en direct » des zones de texte Markdown : un seul réglage pour toute l'application, gardé dans le navigateur. */
const STORAGE_KEY = 'dash4.markdown.live'

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const liveMarkdownPreview = ref(read())

export function setLiveMarkdownPreview(on: boolean): void {
  liveMarkdownPreview.value = on
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Navigation privée : le réglage vaut pour la session
  }
}
