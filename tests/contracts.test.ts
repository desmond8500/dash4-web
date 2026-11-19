import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import { contractSeverity, linesTotal, yearlyAmount } from '../src/utils/contracts'

describe('contrats', () => {
  it('calcule le montant d\'une période et d\'une année', () => {
    expect(linesTotal([{ quantity: 3, unit_price: 75000 }, { quantity: 1, unit_price: 30000 }])).toBe(255000)
    expect(linesTotal([{ quantity: 2, unit_price: undefined }])).toBe(0)
    expect(yearlyAmount(255000, 3)).toBe(1020000)
  })

  it('signale les contrats à facturer ou en fin de préavis', () => {
    const c = (value: string, invoice_due = false, ends_soon = false) => ({ status: { value: value as 'active', label: '' }, invoice_due, ends_soon })
    expect(contractSeverity(c('active', true))).toBe('warn')
    expect(contractSeverity(c('active', false, true))).toBe('danger')
    expect(contractSeverity(c('ended'))).toBe('secondary')
  })

  it('montre les contrats à qui a contracts.view', () => {
    expect(visibleMenu((p) => p.includes('contracts.view')).map((e) => e.label)).toContain('Contrats')
  })
})
