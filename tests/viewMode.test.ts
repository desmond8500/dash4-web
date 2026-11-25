import { describe, expect, it } from 'vitest'
import { readViewMode } from '../src/composables/useViewMode'

describe('affichage en tableau ou en cartes', () => {
  const storage = (values: Record<string, string>) => ({ getItem: (k: string) => values[k] ?? null })

  it('reprend le choix gardé pour chaque liste, tableau par défaut', () => {
    const saved = storage({ 'dash4.view.clients': 'cards', 'dash4.view.quotes': 'table' })
    expect(readViewMode('clients', saved)).toBe('cards')
    expect(readViewMode('quotes', saved)).toBe('table')
    expect(readViewMode('projects', saved)).toBe('table')
  })

  it('ignore une valeur inconnue ou un stockage indisponible', () => {
    expect(readViewMode('clients', storage({ 'dash4.view.clients': 'mosaïque' }))).toBe('table')
    expect(readViewMode('clients', null)).toBe('table')
    expect(readViewMode('clients', { getItem: () => { throw new Error('bloqué') } })).toBe('table')
  })
})
