import { describe, expect, it } from 'vitest'
import { barHeights, monthLabel, moveWidget, toggleWidget, trend } from '../src/utils/dashboard'

describe('tableau de bord', () => {
  it('réordonne et masque les widgets', () => {
    expect(moveWidget(['my_tasks', 'revenue', 'stock'], 'stock', -1)).toEqual(['my_tasks', 'stock', 'revenue'])
    expect(moveWidget(['my_tasks', 'revenue'], 'my_tasks', -1)).toEqual(['my_tasks', 'revenue'])
    const layout = toggleWidget({ order: ['stock'], hidden: [] }, 'stock')
    expect(layout.hidden).toEqual(['stock'])
    expect(toggleWidget(layout, 'stock').hidden).toEqual([])
  })

  it('prépare le graphique des encaissements', () => {
    expect(barHeights([0, 50, 100])).toEqual([0, 0.5, 1])
    expect(barHeights([0, 0])).toEqual([0, 0])
    expect(monthLabel('2026-11')).toContain('nov')
    expect(trend(120, 100)).toBe(20)
    expect(trend(50, 0)).toBeNull()
  })
})
