import { describe, expect, it } from 'vitest'
import { legendLayout, legendPanelWidth, legendPlacement, renderSize } from '../src/utils/planRender'

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
    expect(l.blocks[4]!.y).toBe(24 + 40 + 36 + 30 + 12)
    expect(l.height).toBe(24 * 2 + 40 + 36 + 6 * 30 + 12)
    expect(legendLayout([3], 500).columns).toBe(1)
  })

  it('place la légende sous le plan, à droite ou dessus', () => {
    const plan = { width: 1600, height: 1000 }
    const below = legendPlacement([2, 3], plan, 'below')
    expect(below).toMatchObject({ x: 0, y: 1000, canvasWidth: 1600 })
    expect(below.canvasHeight).toBe(1000 + below.layout!.height)

    const right = legendPlacement([2, 3], plan, 'right')
    expect(right).toMatchObject({ x: 1600, y: 0, canvasWidth: 1600 + legendPanelWidth(1600) })
    expect(right.layout!.columns).toBe(1)

    // Posée sur le plan : gardée à l'intérieur, même tirée hors du cadre
    const over = legendPlacement([2], plan, 'overlay', 1, { x: 0.95, y: 0.99 })
    expect(over.canvasWidth).toBe(1600)
    expect(over.x).toBe(1600 - over.layout!.width)
    expect(over.y).toBe(1000 - over.layout!.height)
    expect(legendPlacement([2], plan, 'overlay', 2).layout!.width).toBe(legendPanelWidth(1600) * 2)
    expect(legendPlacement([], plan, 'right')).toMatchObject({ layout: null, canvasWidth: 1600 })
  })
})
