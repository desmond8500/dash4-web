import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppNotification, ClientRequestSummary } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from './auth'

const REFRESH_MS = 120_000

/**
 * Demandes clients partagées par tout l'écran : compteurs du menu et du tableau de bord,
 * fenêtre de saisie express (bouton « + Demande »), notifications (relances).
 */
export const useClientRequestsStore = defineStore('clientRequests', () => {
  const auth = useAuthStore()

  const summary = ref<ClientRequestSummary | null>(null)
  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)

  // Saisie express
  const quickOpen = ref(false)
  const quickClientId = ref<number | null>(null)
  /** Augmente à chaque création ou modification : les listes ouvertes se rechargent. */
  const version = ref(0)

  async function refreshSummary(): Promise<void> {
    if (!auth.canAny(['client_requests.view', 'client_requests.view.own'])) return
    try {
      summary.value = await api.clientRequests.summary()
    } catch {
      // Compteur indicatif : une erreur ici ne doit pas gêner l'écran
    }
  }

  async function refreshNotifications(): Promise<void> {
    if (!auth.isAuthenticated) return
    try {
      const page = await api.notifications.list({ per_page: 15 })
      notifications.value = page.data
      unreadCount.value = page.meta.unread_count
    } catch {
      // idem
    }
  }

  async function markRead(id: string): Promise<void> {
    await api.notifications.read(id)
    const n = notifications.value.find((x) => x.id === id)
    if (n && !n.read_at) {
      n.read_at = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  async function markAllRead(): Promise<void> {
    await api.notifications.readAll()
    const now = new Date().toISOString()
    notifications.value.forEach((n) => (n.read_at ??= now))
    unreadCount.value = 0
  }

  function openQuick(clientId: number | null = null): void {
    quickClientId.value = clientId
    quickOpen.value = true
  }

  function changed(): void {
    version.value++
    void refreshSummary()
  }

  let timer: ReturnType<typeof setInterval> | undefined

  function start(): void {
    void refreshSummary()
    void refreshNotifications()
    clearInterval(timer)
    timer = setInterval(() => {
      void refreshSummary()
      void refreshNotifications()
    }, REFRESH_MS)
  }

  function stop(): void {
    clearInterval(timer)
    summary.value = null
    notifications.value = []
    unreadCount.value = 0
  }

  return {
    summary,
    notifications,
    unreadCount,
    quickOpen,
    quickClientId,
    version,
    refreshSummary,
    refreshNotifications,
    markRead,
    markAllRead,
    openQuick,
    changed,
    start,
    stop,
  }
})
