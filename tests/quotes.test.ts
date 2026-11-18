import { describe, expect, it } from 'vitest'
import type { Quote } from '@dash4/shared'
import { visibleMenu } from '../src/menu'
import { coefficientLabel, linePrice, parseEmails, quoteStatusSeverity, sortedByCategory, statusActions } from '../src/utils/quotes'

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

describe('tri des lignes par catégorie', () => {
  const line = (id: number, category: string) => ({ id, category: { value: category, label: category } }) as never

  it('range centrale, organes, câble, accessoires, main-d\'œuvre puis autre', () => {
    expect(
      sortedByCategory([line(1, 'service'), line(2, 'cable'), line(3, 'central'), line(4, 'other'), line(5, 'device'), line(6, 'accessory')]),
    ).toEqual([3, 5, 2, 6, 1, 4])
  })

  it('garde l\'ordre actuel dans une même catégorie', () => {
    expect(sortedByCategory([line(7, 'device'), line(8, 'central'), line(9, 'device'), line(10, 'central')])).toEqual([8, 10, 7, 9])
  })
})

describe('destinataires de l\'envoi par e-mail', () => {
  it('sépare les adresses valides des autres, sans doublon de casse', () => {
    expect(parseEmails(' Client@Example.sn, direction@example.sn; pas-une-adresse ')).toEqual({
      valid: ['client@example.sn', 'direction@example.sn'],
      invalid: ['pas-une-adresse'],
    })
    expect(parseEmails('')).toEqual({ valid: [], invalid: [] })
  })
})
