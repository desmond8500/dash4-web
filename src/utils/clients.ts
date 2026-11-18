import type { ClientStatus } from '@dash4/shared'

/** Couleur du badge de statut d'un client. */
export function statusSeverity(status: ClientStatus): 'success' | 'info' | 'secondary' {
  switch (status) {
    case 'active':
      return 'success'
    case 'prospect':
      return 'info'
    default:
      return 'secondary'
  }
}
