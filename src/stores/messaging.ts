import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { useAuthStore } from './auth'
import { shouldNotify } from '@/utils/messaging'

const REFRESH_MS = 30_000

/**
 * Compteur de messages non lus (menu) relevé toutes les 30 secondes, et notification du navigateur
 * quand un message arrive alors que l'onglet n'est pas au premier plan (si la personne l'a permis).
 */
export const useMessagingStore = defineStore('messaging', () => {
  const auth = useAuthStore()
  const unread = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

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

  function start(): void {
    if (timer) return
    void refresh()
    timer = setInterval(() => void refresh(), REFRESH_MS)
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { unread, refresh, start, stop }
})
