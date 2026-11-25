import { describe, expect, it } from 'vitest'
import { LINK_TYPES, linkRoute } from '../src/utils/practicalTools'
import { visibleMenu } from '../src/menu'

describe('outils pratiques', () => {
  it('ouvre la fiche de la marque, du fournisseur ou de l\'article lié', () => {
    const target = { id: 7, name: 'Honeywell', reference: null }
    expect(linkRoute({ type: 'brands', target })).toEqual({ name: 'brand', params: { id: 7 } })
    expect(linkRoute({ type: 'providers', target })).toEqual({ name: 'provider', params: { id: 7 } })
    expect(linkRoute({ type: 'articles', target })).toEqual({ name: 'article', params: { id: 7 } })
    expect(LINK_TYPES.map((t) => t.value)).toEqual(['brands', 'providers', 'articles'])
  })

  it('est dans le menu de tous les comptes', () => {
    expect(visibleMenu(() => false).map((e) => e.label)).toContain('Outils pratiques')
  })
})
