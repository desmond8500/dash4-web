import { describe, expect, it } from 'vitest'
import { exportPeriods } from '../src/utils/exports'

describe('exports', () => {
  it('propose les périodes usuelles', () => {
    const p = Object.fromEntries(exportPeriods(new Date(2026, 1, 15)).map((x) => [x.key, [x.from, x.to]]))
    expect(p.month).toEqual(['2026-02-01', '2026-02-28'])
    expect(p['last-month']).toEqual(['2026-01-01', '2026-01-31'])
    expect(p.quarter).toEqual(['2026-01-01', '2026-03-31'])
    expect(p['last-year']).toEqual(['2025-01-01', '2025-12-31'])
  })
})

describe('menu des exports', () => {
  it('est caché sans le droit de voir les prix', async () => {
    const { visibleMenu } = await import('../src/menu')
    const menu = (perms: string[]) => visibleMenu((w) => w.some((p) => perms.includes(p))).map((e) => e.to)
    expect(menu(['exports.run'])).not.toContain('/exports')
    expect(menu(['exports.run', 'prices.view'])).toContain('/exports')
  })
})
