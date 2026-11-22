import { describe, expect, it } from 'vitest'
import { legendLayout, renderSize } from '../src/utils/planRender'

describe('aperçu des plans', () => {
  it('ramène les grands plans à 3000 px de large', () => {
    expect(renderSize(6000, 4000)).toEqual({ width: 3000, height: 2000, scale: 0.5 })
    expect(renderSize(1200, 800)).toEqual({ width: 1200, height: 800, scale: 1 })
  })

  it('met la légende en colonnes sous le plan', () => {
    expect(legendLayout(0, 1600).height).toBe(0)
    const l = legendLayout(9, 1600)
    expect(l.columns).toBe(4)
    expect(l.height).toBe(24 * 2 + 30 + 3 * 34)
    expect(legendLayout(3, 500).columns).toBe(1)
  })
})
