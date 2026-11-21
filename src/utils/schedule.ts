import type { ScheduleItem } from '@dash4/shared'

export interface ScheduleMonth {
  key: string
  label: string
  items: ScheduleItem[]
  total: number
}

/** Regroupe l'échéancier par mois ; ce qui est en retard est rangé dans « En retard », en tête. */
export function groupByMonth(items: ScheduleItem[], today: Date = new Date()): ScheduleMonth[] {
  const months = new Map<string, ScheduleMonth>()
  const todayKey = today.toISOString().slice(0, 10)
  for (const item of items) {
    const late = item.overdue || (!!item.date && item.date < todayKey)
    const key = late ? '0000-00' : (item.date ?? '9999-99').slice(0, 7)
    if (!months.has(key)) {
      const label = late
        ? 'En retard'
        : key === '9999-99'
          ? 'Sans date'
          : new Date(`${key}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      months.set(key, { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [], total: 0 })
    }
    const month = months.get(key)!
    month.items.push(item)
    month.total += item.amount
  }
  return [...months.values()].sort((a, b) => a.key.localeCompare(b.key))
}
