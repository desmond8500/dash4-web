import { describe, expect, it } from 'vitest'
import type { Quote } from '@dash4/shared'
import { visibleMenu } from '../src/menu'
import { coefficientLabel, linePrice, quoteStatusSeverity, statusActions } from '../src/utils/quotes'

const quote = (status: Quote['status']['value'], can: Partial<Quote['can']> = {}) =>
  ({
    status: { value: status, label: status },
    can: { update: true, validate: false, delete: false, export: true, edit_prices: true, ...can },
  }) as Pick<Quote, 'status' | 'can'>

describe('devis', () => {
  it('calcule le prix pendant la saisie comme l\'API : coût × coefficient, arrondi au franc', () => {
    expect(linePrice(50000, 1.5, 4)).toEqual({ unitPrice: 75000, total: 300000 })
    expect(linePrice(333, 1.333, 3)).toEqual({ unitPrice: 444, total: 1332 })
    expect(linePrice(1000, 1, 0.5)).toEqual({ unitPrice: 1000, total: 500 })
  })

  it('propose « accepté » et « refusé » seulement avec le droit de valider', () => {
    expect(statusActions(quote('sent')).map((a) => a.status)).toEqual(['draft', 'cancelled'])
    expect(statusActions(quote('sent', { validate: true })).map((a) => a.status)).toEqual([
      'draft',
      'accepted',
      'refused',
      'cancelled',
    ])
    expect(statusActions(quote('accepted'))).toEqual([])
    expect(statusActions(quote('draft', { update: false }))).toEqual([])
  })

  it('colore les statuts et affiche le coefficient', () => {
    expect(quoteStatusSeverity('accepted')).toBe('success')
    expect(quoteStatusSeverity('refused')).toBe('danger')
    expect(coefficientLabel(1.5)).toBe('× 1,5')
  })

  it('montre le menu Devis avec quotes.view ou quotes.view.own', () => {
    const menuFor = (permissions: string[]) =>
      visibleMenu((wanted) => wanted.some((p) => permissions.includes(p))).map((e) => e.to)
    expect(menuFor(['quotes.view.own'])).toContain('/devis')
    expect(menuFor(['clients.view'])).not.toContain('/devis')
  })
})
