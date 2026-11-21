import { describe, expect, it } from 'vitest'
import { contactEmailOptions } from '../src/utils/quotes'

describe('contactEmailOptions', () => {
  it('propose toutes les adresses des contacts, sans doublon ni adresse déjà choisie', () => {
    const contacts = [
      { full_name: 'Awa Diop', email: 'Awa@Client.sn', emails: [{ address: 'compta@client.sn', label: 'Compta' }], client: { name: 'Client SA' } },
      { full_name: 'Moussa Fall', email: 'awa@client.sn', company: 'BTP' },
      { full_name: 'Sans adresse', email: null },
    ]
    expect(contactEmailOptions(contacts, ['compta@client.sn'])).toEqual([{ email: 'awa@client.sn', name: 'Awa Diop', detail: 'Client SA' }])
    expect(contactEmailOptions(contacts).map((o) => o.detail)).toEqual(['Client SA', 'Client SA · Compta'])
  })
})
