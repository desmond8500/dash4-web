import { describe, expect, it } from 'vitest'
import { legendLayout, renderSize } from '../src/utils/planRender'

describe('aperçu des plans', () => {
  it('ramène les grands plans à 3000 px de large', () => {
    expect(renderSize(6000, 4000)).toEqual({ width: 3000, height: 2000, scale: 0.5 })
    expect(renderSize(1200, 800)).toEqual({ width: 1200, height: 800, scale: 1 })
  })

  it('range la légende en blocs par catégorie, chacun dans la colonne la moins haute', () => {
    expect(legendLayout([], 1600).height).toBe(0)
    const l = legendLayout([6, 2, 2, 1, 3], 1600)
    expect(l.columns).toBe(4)
    expect(l.blocks.map((b) => b.x)).toEqual([24, 24 + 388, 24 + 2 * 388, 24 + 3 * 388, 24 + 3 * 388])
    // Le 5e bloc passe sous le 4e (le plus court)
    expect(l.blocks[4]!.y).toBe(24 + 40 + 36 + 30 + 12)
    expect(l.height).toBe(24 * 2 + 40 + 36 + 6 * 30 + 12)
    expect(legendLayout([3], 500).columns).toBe(1)
  })
})
