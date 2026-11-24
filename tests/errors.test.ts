import { describe, expect, it } from 'vitest'
import { ApiError } from '@dash4/shared'
import { apiErrorMessage } from '../src/utils/errors'

describe('message d\'erreur d\'API', () => {
  it('reprend le premier message de validation', () => {
    const e = new ApiError(422, 'Validation', { client_id: ['Choisissez un client.'], title: ['Le titre est requis.'] })
    expect(apiErrorMessage(e)).toBe('Choisissez un client.')
  })

  it('reprend le message de l\'erreur sans validation', () => {
    expect(apiErrorMessage(new ApiError(500, 'Erreur serveur.'))).toBe('Erreur serveur.')
  })

  it('reprend le message d\'une erreur JS classique', () => {
    expect(apiErrorMessage(new Error('Oups.'))).toBe('Oups.')
  })

  it('retombe sur le texte par défaut sinon', () => {
    expect(apiErrorMessage('pas une erreur')).toBe('Une erreur est survenue.')
    expect(apiErrorMessage('pas une erreur', 'Indisponible.')).toBe('Indisponible.')
  })
})
