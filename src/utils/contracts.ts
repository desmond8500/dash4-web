import type { Contract, ContractLine } from '@dash4/shared'

/** Montant d'une période à partir des lignes saisies (prix par période). */
export function linesTotal(lines: Array<Pick<ContractLine, 'quantity' | 'unit_price'>>): number {
  return Math.round(lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0) * 100) / 100
}

/** Montant sur un an selon la périodicité (12, 4, 2 ou 1 période). */
export function yearlyAmount(periodAmount: number, months: number): number {
  return Math.round(periodAmount * (12 / Math.max(months, 1)) * 100) / 100
}

export function contractSeverity(c: Pick<Contract, 'status' | 'invoice_due' | 'ends_soon'>): 'success' | 'warn' | 'danger' | 'secondary' | 'info' {
  if (c.status.value === 'active') return c.invoice_due ? 'warn' : c.ends_soon ? 'danger' : 'success'
  return c.status.value === 'draft' ? 'info' : 'secondary'
}
