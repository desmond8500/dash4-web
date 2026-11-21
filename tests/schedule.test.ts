import { describe, expect, it } from 'vitest'
import type { ScheduleItem } from '@dash4/shared'
import { groupByMonth } from '../src/utils/schedule'

const item = (date: string | null, amount: number, overdue = false): ScheduleItem => ({ kind: 'invoice', id: 1, label: 'x', client: null, date, amount, overdue })

describe('échéancier', () => {
  it('regroupe par mois, retards en tête', () => {
    const months = groupByMonth([item('2026-12-05', 100), item('2026-11-25', 50), item('2026-11-02', 30, true), item('2026-12-20', 20)], new Date('2026-11-20T10:00:00Z'))
    expect(months.map((m) => m.label)).toEqual(['En retard', 'Novembre 2026', 'Décembre 2026'])
    expect(months.map((m) => m.total)).toEqual([30, 50, 120])
  })
})
