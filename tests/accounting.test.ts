import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import { barScale, expenseStatusSeverity, monthLabel, periodLabel, periodRange, shiftPeriod } from '../src/utils/accounting'

describe('comptabilité', () => {
  it('calcule les périodes du bilan', () => {
    const d = new Date(2026, 10, 18)
    expect(periodRange('month', d)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(periodRange('quarter', d)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(periodRange('year', d)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('month', new Date(2028, 1, 10)).to).toBe('2028-02-29')
    expect(shiftPeriod('quarter', d, -1).getMonth()).toBe(7)
    expect(periodLabel('quarter', d)).toBe('4ᵉ trimestre 2026')
    expect(monthLabel('2026-11')).toContain('2026')
  })

  it('met les barres à l\'échelle du plus grand montant', () => {
    const scale = barScale([0, 50, 200])
    expect(scale(200)).toBe(100)
    expect(scale(50)).toBe(25)
    expect(barScale([0, 0])(0)).toBe(0)
    expect(expenseStatusSeverity('submitted')).toBe('warn')
  })

  it('donne Dépenses à tous ceux qui en saisissent, Comptabilité au comptable', () => {
    const labels = (permissions: string[]) => visibleMenu((p) => p.some((x) => permissions.includes(x))).map((e) => e.label)
    expect(labels(['accounting.view.own'])).toContain('Dépenses')
    expect(labels(['accounting.view.own'])).not.toContain('Comptabilité')
    expect(labels(['accounting.view'])).toContain('Comptabilité')
  })
})
