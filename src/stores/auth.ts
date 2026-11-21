import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { can as canFn, canAny as canAnyFn, isAdmin as isAdminFn, isTechnician as isTechnicianFn } from '@dash4/shared'
import type { CurrentUser, LoginPayload } from '@dash4/shared'
import { api, tokenStorage } from '@/services/api'
import { applyTheme } from '@/utils/theme'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null)
  /** Vrai une fois la session vérifiée au démarrage (jeton présent ou non). */
  const ready = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const isTechnician = computed(() => isTechnicianFn(user.value))
  const isAdmin = computed(() => isAdminFn(user.value))

  function can(permission: string): boolean {
    return canFn(user.value, permission)
  }

  function canAny(permissions: string[]): boolean {
    return canAnyFn(user.value, permissions)
  }

  /** Recharge l'utilisateur si un jeton est enregistré. */
  async function init(): Promise<void> {
    if (ready.value) return
    try {
      if (await tokenStorage.get()) {
        user.value = await api.auth.me()
        if (user.value.preferences) applyTheme(user.value.preferences.theme)
      }
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
  }

  async function login(payload: Omit<LoginPayload, 'device_name'>): Promise<CurrentUser> {
    const response = await api.auth.login({ ...payload, device_name: 'Web' })
    user.value = response.user
    if (response.user.preferences) applyTheme(response.user.preferences.theme)
    ready.value = true
    return response.user
  }

  async function logout(): Promise<void> {
    try {
      await api.auth.logout()
    } catch {
      // Jeton déjà invalide : on déconnecte quand même côté interface
    } finally {
      clear()
    }
  }

  /** Oublie l'utilisateur sans appeler l'API (jeton expiré). */
  function clear(): void {
    user.value = null
    void tokenStorage.set(null)
  }

  return { user, ready, isAuthenticated, isTechnician, isAdmin, can, canAny, init, login, logout, clear }
})
