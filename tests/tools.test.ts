import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@dash4/shared'
import { visibleMenu } from '../src/menu'
import { notificationTarget } from '../src/utils/notifications'

describe('outillage', () => {
  it('montre l’outillage à qui voit les outils, ou seulement ceux qu’il a en prêt', () => {
    const labels = (permission: string) => visibleMenu((p) => p.includes(permission)).map((e) => e.label)
    expect(labels('tools.view')).toContain('Outillage')
    expect(labels('tools.view.own')).toContain('Outillage')
    expect(labels('stock.view')).not.toContain('Outillage')
  })

  it('ouvre la fiche de l’outil depuis un rappel de prêt', () => {
    const n = { id: 'x', kind: 'tool_loan.late', title: '', body: '', tool_id: 7, tool_loan_id: 3, read_at: null, created_at: null } as AppNotification
    expect(notificationTarget(n)).toEqual({ name: 'tool', params: { id: 7 } })
  })
})
