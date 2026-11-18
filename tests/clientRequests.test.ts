import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import {
  ageLabel,
  inboxFilters,
  priorityIcon,
  quickActions,
  requesterLabel,
  requestStatusSeverity,
} from '../src/utils/clientRequests'

describe('boîte des demandes clients', () => {
  it('traduit chaque onglet en filtres pour l\'API', () => {
    expect(inboxFilters('open')).toEqual({ open: true })
    expect(inboxFilters('mine')).toEqual({ open: true, assigned: 'me' })
    expect(inboxFilters('overdue')).toEqual({ overdue: true })
    expect(inboxFilters('closed')).toEqual({ status: 'done,dismissed' })
    expect(inboxFilters('all')).toEqual({})
  })

  it('propose les bonnes actions selon le statut', () => {
    expect(quickActions('new').map((a) => a.status)).toEqual(['in_progress', 'done', 'dismissed'])
    expect(quickActions('new')[0]?.assignToMe).toBe(true)
    expect(quickActions('in_progress').map((a) => a.status)).toEqual(['done', 'dismissed'])
    expect(quickActions('done').map((a) => a.label)).toEqual(['Rouvrir'])
  })

  it('affiche le client, sinon le nom, sinon le téléphone', () => {
    expect(requesterLabel({ client: { id: 1, name: 'Hôtel Teranga' }, contact_name: 'X', contact_phone: null })).toBe(
      'Hôtel Teranga',
    )
    expect(requesterLabel({ client: null, contact_name: 'Awa', contact_phone: '77' })).toBe('Awa')
    expect(requesterLabel({ client: null, contact_name: null, contact_phone: '77 000' })).toBe('77 000')
    expect(requesterLabel({ client: null, contact_name: null, contact_phone: null })).toBe('Demandeur non précisé')
  })

  it('donne l\'âge d\'une demande en clair', () => {
    const now = new Date('2026-11-18T12:00:00Z')
    expect(ageLabel('2026-11-18T11:59:40Z', now)).toBe("à l'instant")
    expect(ageLabel('2026-11-18T11:15:00Z', now)).toBe('il y a 45 min')
    expect(ageLabel('2026-11-18T07:00:00Z', now)).toBe('il y a 5 h')
    expect(ageLabel('2026-11-15T12:00:00Z', now)).toBe('il y a 3 j')
    expect(ageLabel(null, now)).toBe('')
  })

  it('colore les statuts et les priorités', () => {
    expect(requestStatusSeverity('new')).toBe('info')
    expect(requestStatusSeverity('done')).toBe('success')
    expect(priorityIcon('high')).toBe('pi pi-angle-double-up')
  })

  it('montre le menu Demandes au technicien comme au bureau, pas au magasinier', () => {
    const menuFor = (permissions: string[]) =>
      visibleMenu((wanted) => wanted.some((p) => permissions.includes(p))).map((e) => e.to)
    expect(menuFor(['client_requests.view'])).toContain('/demandes')
    expect(menuFor(['client_requests.view.own'])).toContain('/demandes')
    expect(menuFor(['stock.view'])).not.toContain('/demandes')
  })
})
