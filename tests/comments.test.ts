import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@dash4/shared'
import { notificationTarget } from '../src/utils/notifications'

const n = (patch: Partial<AppNotification>): AppNotification => ({ id: 'x', kind: 'comment.mention', title: '', body: '', read_at: null, created_at: null, ...patch })

describe('notifications', () => {
  it('ouvre la fiche commentée sur l\'onglet des commentaires', () => {
    expect(notificationTarget(n({ subject_type: 'tasks', subject_id: 4 }))).toEqual({ name: 'task', params: { id: 4 }, query: { onglet: 'commentaires' } })
    expect(notificationTarget(n({ subject_type: 'client-requests', subject_id: 7 }))).toEqual({ name: 'client-requests', query: { demande: 7 } })
  })

  it('garde les autres destinations', () => {
    expect(notificationTarget(n({ kind: 'task.assigned', task_id: 3 }))).toEqual({ name: 'task', params: { id: 3 } })
    expect(notificationTarget(n({ kind: 'access_request.created', tech_access_request_id: 2 }))).toEqual({ name: 'tech-space', query: { onglet: 'demandes' } })
    expect(notificationTarget(n({ kind: 'tech_share.received', tech_share_id: 5 }))).toEqual({ name: 'tech-space', query: { onglet: 'infos' } })
    expect(notificationTarget(n({ kind: 'autre' }))).toBeNull()
  })
})
