import type { DashboardLayout, DashboardWidgetKey } from '@dash4/shared'

/** Monte ou descend un widget dans l'ordre du tableau de bord. */
export function moveWidget(order: DashboardWidgetKey[], key: DashboardWidgetKey, direction: -1 | 1): DashboardWidgetKey[] {
  const i = order.indexOf(key)
  const j = i + direction
  if (i < 0 || j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  return next
}

export function toggleWidget(layout: DashboardLayout, key: DashboardWidgetKey): DashboardLayout {
  const hidden = layout.hidden.includes(key) ? layout.hidden.filter((k) => k !== key) : [...layout.hidden, key]
  return { order: layout.order, hidden }
}

/** Hauteur relative (0 à 1) des barres du graphique des encaissements. */
export function barHeights(values: number[]): number[] {
  const max = Math.max(...values, 0)
  return values.map((v) => (max > 0 ? v / max : 0))
}

/** « nov. » pour « 2026-11 ». */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
}

/** Évolution en pourcentage d'un mois sur l'autre (null si le mois précédent est à zéro). */
export function trend(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}
