import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { resolveNavigation, type GuardState } from '../src/router/guard'
import { visibleMenu } from '../src/menu'

function route(name: string, meta: RouteLocationNormalized['meta'] = {}, fullPath = `/${name}`) {
  return { name, meta, fullPath } as RouteLocationNormalized
}

function state(partial: Partial<GuardState> & { permissions?: string[] } = {}): GuardState {
  const permissions = partial.permissions ?? []
  return {
    isAuthenticated: true,
    isTechnician: false,
    canAny: (wanted) => wanted.some((p) => permissions.includes(p)),
    ...partial,
  }
}

describe('navigation', () => {
  it('envoie vers la connexion sans être connecté, en gardant la page demandée', () => {
    expect(resolveNavigation(route('users', {}, '/utilisateurs'), state({ isAuthenticated: false }))).toEqual({
      name: 'login',
      query: { redirect: '/utilisateurs' },
    })
  })

  it('laisse ouverte la page de connexion, sauf si on est déjà connecté', () => {
    expect(resolveNavigation(route('login', { public: true }), state({ isAuthenticated: false }))).toBe(true)
    expect(resolveNavigation(route('login', { public: true }), state())).toEqual({ name: 'home' })
  })

  it('renvoie un technicien vers la page « application mobile »', () => {
    expect(resolveNavigation(route('home'), state({ isTechnician: true }))).toEqual({ name: 'technician' })
    expect(resolveNavigation(route('technician'), state({ isTechnician: true }))).toBe(true)
  })

  it('refuse une page sans la permission nécessaire', () => {
    const users = route('users', { permissions: ['users.view'] })
    expect(resolveNavigation(users, state())).toEqual({ name: 'forbidden' })
    expect(resolveNavigation(users, state({ permissions: ['users.view'] }))).toBe(true)
  })
})

describe('menu', () => {
  it("n'affiche que les entrées autorisées", () => {
    const labels = visibleMenu((wanted) => wanted.includes('dashboard.view.own')).map((e) => e.label)
    expect(labels).toEqual(['Tableau de bord', 'Messages'])
  })
})

describe('mot de passe oublié', () => {
  it('reste accessible sans être connecté, techniciens compris', () => {
    const to = { name: 'password-reset', meta: { public: true }, fullPath: '/mot-de-passe/nouveau?token=x' } as unknown as RouteLocationNormalized
    expect(resolveNavigation(to, state())).toBe(true)
    expect(resolveNavigation(to, state({ isAuthenticated: true, isTechnician: true }))).toBe(true)
  })
})
