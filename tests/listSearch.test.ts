import { describe, expect, it } from 'vitest'
import { matchesSearch, searchAndSort, searchOnly } from '../src/utils/listSearch'

describe('listSearch', () => {
  it('cherche chaque mot sans tenir compte des accents ni de la casse', () => {
    expect(matchesSearch('', 'x')).toBe(true)
    expect(matchesSearch('ecole camera', 'Vidéosurveillance École', 'Caméras dôme')).toBe(true)
    expect(matchesSearch('ecole incendie', 'Vidéosurveillance École')).toBe(false)
    expect(matchesSearch('DV-2026', null, 'DV-2026-014')).toBe(true)
  })

  it('trie par ordre alphabétique après filtrage', () => {
    const projects = [{ name: 'Zone 10' }, { name: 'école' }, { name: 'Zone 2' }, { name: 'Atelier' }]
    expect(searchAndSort(projects, '', (p) => p.name).map((p) => p.name)).toEqual(['Atelier', 'école', 'Zone 2', 'Zone 10'])
    expect(searchAndSort(projects, 'zone', (p) => p.name).map((p) => p.name)).toEqual(['Zone 2', 'Zone 10'])
  })

  it('peut filtrer sans trier', () => {
    expect(searchOnly([{ t: 'b' }, { t: 'a' }], '', (i) => [i.t]).map((i) => i.t)).toEqual(['b', 'a'])
  })
})
