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

/** Adresse de l'API utilisée par cette version (VITE_API_URL au moment du build). */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export const api = createApiClient({
  baseUrl: API_URL,
  storage: tokenStorage,
  onUnauthorized: () => unauthorizedHandler(),
})
