import { describe, expect, it } from 'vitest'
import { addableUsers, isSendKey, shouldNotify } from '../src/utils/messaging'
import { MENU, visibleMenu } from '../src/menu'

describe('messagerie', () => {
  it('notifie seulement onglet caché, permission donnée, nouveaux messages', () => {
    expect(shouldNotify(1, 2, 'hidden', 'granted')).toBe(true)
    expect(shouldNotify(2, 2, 'hidden', 'granted')).toBe(false)
    expect(shouldNotify(1, 2, 'visible', 'granted')).toBe(false)
    expect(shouldNotify(1, 2, 'hidden', 'default')).toBe(false)
  })

  it('propose les personnes absentes du groupe', () => {
    const users = [
      { id: 1, full_name: 'A', job_title: null, avatar_url: null },
      { id: 2, full_name: 'B', job_title: null, avatar_url: null },
    ]
    expect(addableUsers(users, { members: [{ id: 1, full_name: 'A', job_title: null, avatar_url: null, last_read_message_id: null }] }).map((u) => u.id)).toEqual([2])
  })

  it('envoie avec Entrée', () => {
    expect(isSendKey({ key: 'Enter', shiftKey: false, isComposing: false })).toBe(true)
    expect(isSendKey({ key: 'Enter', shiftKey: true, isComposing: false })).toBe(false)
  })

  it('montre la messagerie à tous', () => {
    expect(MENU.some((e) => e.to === '/messages')).toBe(true)
    expect(visibleMenu(() => false).map((e) => e.to)).toEqual(['/messages'])
  })
})
