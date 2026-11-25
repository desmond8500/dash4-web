import { describe, expect, it } from 'vitest'
import type { Contact, RecordContact } from '@dash4/shared'
import { contactChannels, contactSubtitle, movedIds, unlinkedContacts } from '../src/utils/recordContacts'

const contact = (id: number, full_name: string, extra: Partial<Contact> = {}) => ({ id, full_name, ...extra }) as Contact
const link = (id: number, c: Contact) => ({ id, role: null, position: 0, contact: c, created_at: null }) as RecordContact

describe('contacts liés à un projet ou un devis', () => {
  it('propose les contacts du client pas encore liés, par ordre alphabétique', () => {
    const awa = contact(1, 'Awa Ndiaye')
    expect(unlinkedContacts([contact(3, 'Moussa Fall'), awa, contact(2, 'Ébou Sarr')], [link(9, awa)]).map((c) => c.id)).toEqual([2, 3])
  })

  it('résume la fonction et la société, ou le client', () => {
    expect(contactSubtitle({ job_title: 'Architecte', company: null, client: { id: 1, name: 'Hôtel Teranga' } })).toBe('Architecte · Hôtel Teranga')
    expect(contactSubtitle({ job_title: null, company: 'Socotec', client: null })).toBe('Socotec')
  })

  it('réunit les téléphones et e-mails sans doublon', () => {
    expect(
      contactChannels({
        phone: '77 000 00 00',
        email: null,
        phones: [{ id: 1, label: 'Mobile', number: '77 000 00 00' }, { id: 2, label: 'Bureau', number: '33 800 00 00' }] as never,
        emails: [{ id: 1, label: null, address: 'awa@example.com' }] as never,
      }),
    ).toEqual({ phones: ['77 000 00 00', '33 800 00 00'], emails: ['awa@example.com'] })
  })

  it('déplace un contact d\'une place, sans sortir de la liste', () => {
    const links = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(movedIds(links, 0, 1)).toEqual([2, 1, 3])
    expect(movedIds(links, 0, -1)).toEqual([1, 2, 3])
  })
})
