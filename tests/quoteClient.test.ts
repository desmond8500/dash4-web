import { describe, expect, it } from 'vitest'
import { quoteClientPayload } from '../src/utils/quoteClient'

const quote = { client_id: 1, project_id: 5, client_name: null, client: { id: 1, name: 'Hôtel Teranga' } }

describe('client du devis', () => {
  it("n'envoie que ce qui change", () => {
    expect(quoteClientPayload(quote, 1, 5, '')).toEqual({})
    expect(quoteClientPayload(quote, 1, 5, ' Teranga SA ')).toEqual({ client_name: 'Teranga SA' })
    expect(quoteClientPayload(quote, 1, null, '')).toEqual({ project_id: null })
    // Même nom que la fiche : pas de nom propre
    expect(quoteClientPayload(quote, 1, 5, 'Hôtel Teranga')).toEqual({})
    expect(quoteClientPayload({ ...quote, client_name: 'Ancien' }, 1, 5, '')).toEqual({ client_name: null })
  })

  it('envoie toujours le projet en changeant de client', () => {
    expect(quoteClientPayload(quote, 2, null, '', 'Groupe Kër')).toEqual({ client_id: 2, project_id: null })
    expect(quoteClientPayload(quote, 2, 9, 'Groupe Kër', 'Groupe Kër')).toEqual({ client_id: 2, project_id: 9 })
    expect(quoteClientPayload({ ...quote, client_name: 'X' }, 2, null, 'X', 'Groupe Kër')).toEqual({ client_id: 2, project_id: null })
  })
})
