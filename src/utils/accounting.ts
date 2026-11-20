import type { ExpenseStatus } from '@dash4/shared'
import type { Severity } from './clientRequests'

export function expenseStatusSeverity(status: ExpenseStatus): Severity {
  switch (status) {
    case 'submitted':
      return 'warn'
    case 'approved':
      return 'info'
    case 'reimbursed':
      return 'success'
    default:
      return 'danger'
  }
}

export type PeriodKind = 'month' | 'quarter' | 'year'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Début et fin de la période (mois, trimestre, année) qui contient la date. */
export function periodRange(kind: PeriodKind, date: Date): { from: string; to: string } {
  const y = date.getFullYear()
  const m = date.getMonth()
  if (kind === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` }
  if (kind === 'quarter') {
    const start = Math.floor(m / 3) * 3
    return { from: iso(new Date(y, start, 1)), to: iso(new Date(y, start + 3, 0)) }
  }
  return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
}

/** Période précédente ou suivante. */
export function shiftPeriod(kind: PeriodKind, date: Date, step: -1 | 1): Date {
  const months = kind === 'year' ? 12 : kind === 'quarter' ? 3 : 1
  return new Date(date.getFullYear(), date.getMonth() + step * months, 1)
}

export function periodLabel(kind: PeriodKind, date: Date): string {
  if (kind === 'year') return String(date.getFullYear())
  if (kind === 'quarter') return `${Math.floor(date.getMonth() / 3) + 1}ᵉ trimestre ${date.getFullYear()}`
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

/** « 2026-11 » → « nov. 2026 ». */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

/** Hauteur des barres en pourcentage du plus grand montant. */
export function barScale(values: number[]): (value: number) => number {
  const max = Math.max(0, ...values)
  return (value) => (max === 0 ? 0 : Math.round((value / max) * 100))
}
