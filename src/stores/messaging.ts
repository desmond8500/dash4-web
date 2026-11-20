import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { useAuthStore } from './auth'
import { shouldNotify } from '@/utils/messaging'

/** Onglet affiché : toutes les 30 s ; onglet caché : toutes les 2 min, juste pour la notification. */
export const VISIBLE_MS = 30_000
export const HIDDEN_MS = 120_000

/**
 * Compteur de messages non lus (menu), et notification du navigateur quand un message arrive alors
 * que l'onglet n'est pas au premier plan (si la personne l'a permis). Relevé à un rythme lent quand
 * l'onglet est caché, tout de suite quand on y revient.
 */
export const useMessagingStore = defineStore('messaging', () => {
  const auth = useAuthStore()
  const unread = ref(0)
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false

  async function refresh(): Promise<void> {
    if (!auth.isAuthenticated) return
    try {
      const count = await api.messaging.unread()
      const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
      if (shouldNotify(unread.value, count, document.visibilityState, permission)) {
        new Notification('Dash4', { body: count - unread.value > 1 ? `${count - unread.value} nouveaux messages` : 'Nouveau message', tag: 'dash4-messages' })
      }
      unread.value = count
    } catch {
      // compteur indicatif
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer)
    timer = started ? setTimeout(() => void refresh().finally(schedule), document.visibilityState === 'visible' ? VISIBLE_MS : HIDDEN_MS) : null
  }

  function onVisibility(): void {
    if (document.visibilityState === 'visible') void refresh().finally(schedule)
    else schedule()
  }

  function start(): void {
    if (started) return
    started = true
    document.addEventListener('visibilitychange', onVisibility)
    void refresh().finally(schedule)
  }

  function stop(): void {
    started = false
    if (timer) clearTimeout(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisibility)
  }

  return { unread, refresh, start, stop }
})
