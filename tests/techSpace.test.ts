import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import { defaultExpiry, expiryLabel, shareFormError, sharePayload } from '../src/utils/techSpace'
import type { ShareForm } from '../src/utils/techSpace'

const now = new Date(2026, 10, 19, 10, 0)
const form = (over: Partial<ShareForm> = {}): ShareForm => ({
  category: 'access', title: 'Code portail', content: ' 1234 ', project_id: null, task_id: null,
  expires_at: new Date(2026, 10, 19, 19, 0), expires_with_task: false, recipients: [4], ...over,
})

describe('espace technicien', () => {
  it('décrit l\'expiration d\'une information', () => {
    const at = (d: Date) => ({ expired: false, expires_with_task: false, expires_at: d.toISOString() })
    expect(expiryLabel(at(new Date(2026, 10, 19, 10, 30)), now)).toBe('Expire dans 30 min')
    expect(expiryLabel(at(new Date(2026, 10, 19, 18, 0)), now)).toBe("Expire aujourd'hui à 18:00")
    expect(expiryLabel(at(new Date(2026, 10, 20, 8, 15)), now)).toBe('Expire demain à 08:15')
    expect(expiryLabel(at(new Date(2026, 10, 25, 8, 0)), now)).toBe('Expire le 25/11 à 08:00')
    expect(expiryLabel(at(new Date(2026, 10, 19, 9, 0)), now)).toBe('Expirée')
    expect(expiryLabel({ expired: false, expires_with_task: true, expires_at: null }, now)).toBe("Jusqu'à la fin de la tâche")
  })

  it('propose ce soir 19:00, ou demain si c\'est trop proche', () => {
    expect(defaultExpiry(now)).toEqual(new Date(2026, 10, 19, 19, 0))
    expect(defaultExpiry(new Date(2026, 10, 19, 18, 30))).toEqual(new Date(2026, 10, 20, 19, 0))
  })

  it('vérifie le formulaire et prépare l\'envoi', () => {
    expect(shareFormError(form(), now)).toBeNull()
    expect(shareFormError(form({ recipients: [] }), now)).toBe('Choisissez au moins un destinataire.')
    expect(shareFormError(form({ expires_at: new Date(2026, 10, 19, 9, 0) }), now)).toContain('futur')
    expect(shareFormError(form({ expires_with_task: true }), now)).toBe('Choisissez la tâche.')
    expect(sharePayload(form())).toMatchObject({ content: '1234', expires_with_task: false, recipients: [4] })
    expect(sharePayload(form({ expires_with_task: true, task_id: 3 })).expires_at).toBeNull()
  })

  it('montre l\'espace technicien à qui a les droits', () => {
    const labels = (perms: string[]) => visibleMenu((p) => p.some((x) => perms.includes(x))).map((e) => e.label)
    expect(labels(['tech_shares.view.own'])).toContain('Espace technicien')
    expect(labels(['tech_access_requests.view'])).toContain('Espace technicien')
    expect(labels(['journals.view'])).not.toContain('Espace technicien')
  })
})
