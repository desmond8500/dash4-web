import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings, Currency } from '@dash4/shared'
import { api } from '@/services/api'

/** Paramètres généraux (devise, taux), chargés une fois et rafraîchis après modification. */
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings | null>(null)
  let loading: Promise<void> | null = null

  function load(force = false): Promise<void> {
    if (settings.value && !force) return Promise.resolve()
    loading ??= api.settings
      .get()
      .then((s) => {
        settings.value = s
      })
      .catch(() => undefined)
      .finally(() => {
        loading = null
      })
    return loading
  }

  const currency = (): Currency => settings.value?.currency ?? 'XOF'

  return { settings, load, currency }
})
