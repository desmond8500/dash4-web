import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page accessible sans être connecté (connexion). */
    public?: boolean
    /** Au moins une de ces permissions est nécessaire. */
    permissions?: string[]
    /** Titre de l'onglet du navigateur. */
    title?: string
  }
}

export interface GuardState {
  isAuthenticated: boolean
  isTechnician: boolean
  canAny: (permissions: string[]) => boolean
}

/**
 * Décide où envoyer l'utilisateur avant d'afficher une page.
 * Renvoie `true` pour afficher la page demandée, sinon une redirection.
 */
export function resolveNavigation(to: RouteLocationNormalized, state: GuardState): true | RouteLocationRaw {
  if (to.meta.public) {
    // Déjà connecté : la page de connexion renvoie vers l'accueil
    return to.name === 'login' && state.isAuthenticated ? { name: 'home' } : true
  }

  if (!state.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }

  // Les techniciens utilisent l'application mobile, pas le front web
  if (state.isTechnician) {
    return to.name === 'technician' ? true : { name: 'technician' }
  }

  if (to.name === 'technician') {
    return { name: 'home' }
  }

  if (to.meta.permissions?.length && !state.canAny(to.meta.permissions)) {
    return { name: 'forbidden' }
  }

  return true
}
