import type { Quote, QuotePayload } from '@dash4/shared'

/**
 * Modification du client d'un devis : seulement ce qui change.
 * En changeant de client, le projet est toujours envoyé (l'API refuse un projet d'un autre client).
 * Un nom identique à celui de la fiche n'est pas gardé (il suivrait mal un renommage du client).
 */
export function quoteClientPayload(
  quote: Pick<Quote, 'client_id' | 'project_id' | 'client_name' | 'client'>,
  clientId: number,
  projectId: number | null,
  clientName: string,
  clientRecordName: string | null = null,
): Partial<QuotePayload> {
  const payload: Partial<QuotePayload> = {}
  if (clientId !== quote.client_id) {
    payload.client_id = clientId
    payload.project_id = projectId
  } else if (projectId !== quote.project_id) {
    payload.project_id = projectId
  }
  const recordName = clientId === quote.client_id ? (quote.client?.name ?? null) : clientRecordName
  const name = clientName.trim() && clientName.trim() !== recordName ? clientName.trim() : null
  if (name !== (quote.client_name ?? null)) payload.client_name = name
  return payload
}
