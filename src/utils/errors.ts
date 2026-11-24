import { ApiError } from '@dash4/shared'

/**
 * Message à afficher pour une erreur d'API : premier message de validation (`ApiError.errors`),
 * sinon le message de l'erreur, sinon un texte générique. Un seul endroit pour ce choix, repris
 * par `toast.add({ summary: 'Chargement impossible', detail: apiErrorMessage(e) })` et consorts.
 */
export function apiErrorMessage(e: unknown, fallback = 'Une erreur est survenue.'): string {
  if (e instanceof ApiError) return Object.values(e.errors)[0]?.[0] ?? e.message
  if (e instanceof Error) return e.message
  return fallback
}
