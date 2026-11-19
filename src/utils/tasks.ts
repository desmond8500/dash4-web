import type { Task, TaskStatus, UserRef } from '@dash4/shared'
import type { Severity } from './clientRequests'

export function taskStatusSeverity(status: TaskStatus): Severity {
  switch (status) {
    case 'todo':
      return 'secondary'
    case 'in_progress':
      return 'info'
    case 'blocked':
      return 'danger'
    case 'done':
      return 'success'
    default:
      return 'contrast'
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** « AAAA-MM-JJ HH:MM » (heure locale) pour l'API, ou null. */
export function toApiDateTime(d: Date | null): string | null {
  return d ? `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : null
}

/** « 2026-11-23T08:30:00 » → Date locale. */
export function fromApiDateTime(value: string | null): Date | null {
  if (!value) return null
  const [date, time = '00:00'] = value.split('T')
  const [y, m, d] = date!.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y!, m! - 1, d, h, min)
}

/** Lundi de la semaine qui contient la date. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** Les 7 jours (AAAA-MM-JJ) de la semaine, du lundi au dimanche. */
export function weekDays(date: Date): string[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => isoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)))
}

/** La tâche est-elle au planning ce jour-là (créneau sur plusieurs jours compris) ? */
export function isOnDay(task: Pick<Task, 'starts_at' | 'ends_at'>, day: string): boolean {
  if (!task.starts_at) return false
  const start = task.starts_at.slice(0, 10)
  const end = (task.ends_at ?? task.starts_at).slice(0, 10)
  return start <= day && day <= end
}

/** « 08:30 – 12:00 », ou « Dès 08:30 » ; vide si journée entière (00:00). */
export function timeRange(task: Pick<Task, 'starts_at' | 'ends_at'>, day?: string): string {
  if (!task.starts_at) return ''
  const time = (v: string) => v.slice(11, 16)
  const startsToday = !day || task.starts_at.startsWith(day)
  const endsToday = !day || !task.ends_at || task.ends_at.startsWith(day)
  const start = startsToday ? time(task.starts_at) : null
  const end = task.ends_at && endsToday ? time(task.ends_at) : null
  if (start === '00:00' && !end) return ''
  if (start && end) return `${start} – ${end}`
  if (start) return `Dès ${start}`
  if (end) return `Jusqu'à ${end}`
  return 'Toute la journée'
}

/** Déplace le créneau sur un autre jour en gardant l'heure et la durée. */
export function moveToDay(task: Pick<Task, 'starts_at' | 'ends_at'>, day: string): { starts_at: string; ends_at: string | null } {
  const start = fromApiDateTime(task.starts_at) ?? new Date(`${day}T08:00:00`)
  const end = fromApiDateTime(task.ends_at)
  const [y, m, d] = day.split('-').map(Number)
  const newStart = new Date(y!, m! - 1, d, start.getHours(), start.getMinutes())
  const newEnd = end ? new Date(newStart.getTime() + (end.getTime() - start.getTime())) : null
  return { starts_at: toApiDateTime(newStart)!, ends_at: toApiDateTime(newEnd) }
}

export interface PlanningRow {
  key: string
  person: UserRef | null
  tasks: Task[]
}

/** Une ligne par personne affectée (ordre alphabétique), plus « Non affectées » en dernier. */
export function planningRows(tasks: Task[], people: UserRef[] = []): PlanningRow[] {
  const rows = new Map<string, PlanningRow>()
  for (const p of people) rows.set(`u${p.id}`, { key: `u${p.id}`, person: p, tasks: [] })
  for (const task of tasks) {
    const assignees = task.assignees ?? []
    if (!assignees.length) {
      if (!rows.has('none')) rows.set('none', { key: 'none', person: null, tasks: [] })
      rows.get('none')!.tasks.push(task)
    }
    for (const a of assignees) {
      if (!rows.has(`u${a.id}`)) rows.set(`u${a.id}`, { key: `u${a.id}`, person: a, tasks: [] })
      rows.get(`u${a.id}`)!.tasks.push(task)
    }
  }
  return [...rows.values()].sort((a, b) =>
    a.person && b.person ? a.person.full_name.localeCompare(b.person.full_name, 'fr') : a.person ? -1 : 1,
  )
}
