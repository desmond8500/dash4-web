import { describe, expect, it } from 'vitest'
import type { Invoice, Quote } from '@dash4/shared'
import { visibleMenu } from '../src/menu'
import { canReceivePayment, defaultInvoiceTitle, invoicePreview, invoiceStatusSeverity } from '../src/utils/invoices'

const line = (category: string, line_total: number) => ({ category: { value: category, label: category }, line_total })
const quote = {
  discount_rate: 10,
  remaining_to_invoice: 123000,
  sections: [
    { is_visible: true, lines: [line('central', 200000), line('device', 100000), line('accessory', 20000), line('service', 80000)] },
    { is_visible: false, lines: [line('device', 999999)] },
  ],
} as unknown as Quote

describe('factures', () => {
  it('propose le même titre que l\'API selon la partie facturée et le pourcentage', () => {
    expect(defaultInvoiceTitle('all', 100)).toBe('Facture')
    expect(defaultInvoiceTitle('all', 30)).toBe("Facture d'acompte de 30 %")
    expect(defaultInvoiceTitle('equipment', 50)).toBe("Facture d'acompte de 50 % — matériel")
    expect(defaultInvoiceTitle('equipment_accessories', 100)).toBe('Facture — matériel et accessoires')
    expect(defaultInvoiceTitle('labor', 12.5)).toBe("Facture d'acompte de 12,5 % — main-d'œuvre")
    expect(defaultInvoiceTitle('remainder', 100)).toBe('Facture de solde')
  })

  it('estime le montant hors taxes : sections visibles, remise déduite, au pourcentage', () => {
    expect(invoicePreview(quote, 'all', 100)).toBe(360000)
    expect(invoicePreview(quote, 'equipment', 50)).toBe(135000)
    expect(invoicePreview(quote, 'equipment_accessories', 100)).toBe(288000)
    expect(invoicePreview(quote, 'labor', 100)).toBe(72000)
    expect(invoicePreview(quote, 'remainder', 100)).toBe(123000)
  })

  it('n\'accepte un paiement que sur une facture émise non soldée', () => {
    const inv = (status: Invoice['status']['value'], update = true) => ({ status: { value: status, label: '' }, can: { update, edit: false, issue: false, delete: false } })
    expect(canReceivePayment(inv('issued'))).toBe(true)
    expect(canReceivePayment(inv('partially_paid'))).toBe(true)
    expect(canReceivePayment(inv('draft'))).toBe(false)
    expect(canReceivePayment(inv('paid'))).toBe(false)
    expect(canReceivePayment(inv('issued', false))).toBe(false)
    expect(invoiceStatusSeverity('paid')).toBe('success')
  })

  it('montre le menu Factures au commercial et au comptable, pas au technicien', () => {
    const labels = (permissions: string[]) => visibleMenu((p) => p.some((x) => permissions.includes(x))).map((e) => e.label)
    expect(labels(['invoices.view'])).toContain('Factures')
    expect(labels(['interventions.view.own'])).not.toContain('Factures')
  })
})
