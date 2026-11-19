import { describe, expect, it } from 'vitest'
import type { Task } from '@dash4/shared'
import { visibleMenu } from '../src/menu'
import { fromApiDateTime, isOnDay, moveToDay, planningRows, taskStatusSeverity, timeRange, toApiDateTime, weekDays } from '../src/utils/tasks'

const task = (id: number, starts_at: string | null, ends_at: string | null = null, assignees: Array<{ id: number; full_name: string }> = []) =>
  ({ id, starts_at, ends_at, assignees }) as unknown as Task

describe('tâches et planning', () => {
  it('donne les jours de la semaine, du lundi au dimanche', () => {
    expect(weekDays(new Date(2026, 10, 19))).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
    expect(weekDays(new Date(2026, 10, 22))[0]).toBe('2026-11-16')
  })

  it('place une tâche sur plusieurs jours et affiche ses heures', () => {
    const t = task(1, '2026-11-20T08:00:00', '2026-11-23T17:30:00')
    expect(isOnDay(t, '2026-11-21')).toBe(true)
    expect(isOnDay(t, '2026-11-24')).toBe(false)
    expect(timeRange(t, '2026-11-20')).toBe('Dès 08:00')
    expect(timeRange(t, '2026-11-21')).toBe('Toute la journée')
    expect(timeRange(t, '2026-11-23')).toBe("Jusqu'à 17:30")
    expect(timeRange(task(2, '2026-11-20T08:30:00', '2026-11-20T12:00:00'))).toBe('08:30 – 12:00')
  })

  it('déplace un créneau sur un autre jour en gardant l\'heure et la durée', () => {
    expect(moveToDay(task(1, '2026-11-20T22:00:00', '2026-11-21T02:00:00'), '2026-11-25')).toEqual({ starts_at: '2026-11-25 22:00', ends_at: '2026-11-26 02:00' })
    expect(moveToDay(task(1, '2026-11-20T08:00:00'), '2026-11-25')).toEqual({ starts_at: '2026-11-25 08:00', ends_at: null })
    expect(toApiDateTime(fromApiDateTime('2026-11-23T08:30:00'))).toBe('2026-11-23 08:30')
  })

  it('range le planning par personne, les tâches non affectées en dernier', () => {
    const rows = planningRows([
      task(1, null, null, [{ id: 2, full_name: 'Moussa Ndiaye' }, { id: 3, full_name: 'Awa Fall' }]),
      task(2, null),
    ])
    expect(rows.map((r) => r.person?.full_name ?? 'aucune')).toEqual(['Awa Fall', 'Moussa Ndiaye', 'aucune'])
    expect(rows[0]!.tasks.map((t) => t.id)).toEqual([1])
    expect(taskStatusSeverity('blocked')).toBe('danger')
  })

  it('montre Tâches et Planning avec un droit sur les tâches', () => {
    const labels = (permissions: string[]) => visibleMenu((p) => p.some((x) => permissions.includes(x))).map((e) => e.label)
    expect(labels(['tasks.view.own'])).toEqual(expect.arrayContaining(['Tâches', 'Planning']))
    expect(labels(['clients.view'])).not.toContain('Planning')
  })
})
