import { createApiClient, type TokenStorage } from '@dash4/shared'

const TOKEN_KEY = 'dash4.token'

export const tokenStorage: TokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  },
}

/** Appelé quand le jeton n'est plus valide : défini par le routeur au démarrage. */
let unauthorizedHandler: () => void = () => {}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  storage: tokenStorage,
  onUnauthorized: () => unauthorizedHandler(),
})
