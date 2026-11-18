import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import { formatQty, purchaseStatusSeverity, receivedProgress, receptionDraft, receptionPayload, signedQty, stockState } from '../src/utils/stock'

describe('stock et achats', () => {
  it('affiche les quantités et les mouvements signés', () => {
    expect(formatQty(2.5)).toBe('2,5')
    expect(signedQty(5)).toBe('+5')
    expect(signedQty(-2)).toBe('−2')
  })

  it('distingue rupture, stock bas et en stock', () => {
    expect(stockState({ quantity: 0, min_quantity: 3, is_low: true }).label).toBe('Rupture')
    expect(stockState({ quantity: 2, min_quantity: 3, is_low: true }).severity).toBe('warn')
    expect(stockState({ quantity: 9, min_quantity: null, is_low: false }).label).toBe('En stock')
    expect(purchaseStatusSeverity('partially_received')).toBe('warn')
  })

  it('propose le reste à recevoir et n\'envoie que les quantités positives', () => {
    const lines = [
      { id: 1, remaining_quantity: 4 },
      { id: 2, remaining_quantity: 0 },
      { id: 3, remaining_quantity: 2.5 },
    ]
    expect(receptionDraft(lines)).toEqual({ 1: 4, 3: 2.5 })
    expect(receptionPayload({ 1: 4, 3: 0, 5: null })).toEqual([{ id: 1, quantity: 4 }])
    expect(receivedProgress({ lines: [{ received_quantity: 6, quantity: 10 }, { received_quantity: 1, quantity: 1 }] } as never)).toEqual({ received: 7, ordered: 11 })
  })

  it('montre Stock au technicien et au magasinier, Achats seulement avec un droit d\'achat', () => {
    const labels = (permissions: string[]) => visibleMenu((p) => p.some((x) => permissions.includes(x))).map((e) => e.label)
    expect(labels(['stock.view'])).toContain('Stock')
    expect(labels(['stock.view'])).not.toContain('Achats')
    expect(labels(['purchases.view.own'])).toContain('Achats')
  })
})
