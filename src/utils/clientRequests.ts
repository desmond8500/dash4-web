import type { ClientRequest, ClientRequestFilters, ClientRequestStatus, Priority, ClientRequestLink } from '@dash4/shared'

export type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'

export function requestStatusSeverity(status: ClientRequestStatus): Severity {
  switch (status) {
    case 'new':
      return 'info'
    case 'in_progress':
      return 'warn'
    case 'done':
      return 'success'
    default:
      return 'secondary'
  }
}

export function priorityIcon(priority: Priority): string {
  switch (priority) {
    case 'high':
      return 'pi pi-angle-double-up'
    case 'low':
      return 'pi pi-angle-down'
    default:
      return 'pi pi-minus'
  }
}

/** Qui a fait la demande : client, sinon nom, sinon téléphone. */
export function requesterLabel(request: Pick<ClientRequest, 'client' | 'contact_name' | 'contact_phone'>): string {
  return request.client?.name ?? request.contact_name ?? request.contact_phone ?? 'Demandeur non précisé'
}

/** Âge lisible : « à l'instant », « il y a 3 h », « il y a 2 j ». */
export function ageLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ''
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

export function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

/** Onglets de la boîte de réception et filtres envoyés à l'API. */
export type InboxTab = 'open' | 'mine' | 'overdue' | 'closed' | 'all'

export const INBOX_TABS: Array<{ value: InboxTab; label: string }> = [
  { value: 'open', label: 'À traiter' },
  { value: 'mine', label: 'Confiées à moi' },
  { value: 'overdue', label: 'En retard' },
  { value: 'closed', label: 'Traitées' },
  { value: 'all', label: 'Toutes' },
]

export function inboxFilters(tab: InboxTab): ClientRequestFilters {
  switch (tab) {
    case 'open':
      return { open: true }
    case 'mine':
      return { open: true, assigned: 'me' }
    case 'overdue':
      return { overdue: true }
    case 'closed':
      return { status: 'done,dismissed' }
    default:
      return {}
  }
}

/** Actions rapides proposées selon le statut. */
export interface QuickAction {
  label: string
  icon: string
  status: ClientRequestStatus
  /** Prendre en charge : confie aussi la demande à soi-même. */
  assignToMe?: boolean
}

export function quickActions(status: ClientRequestStatus): QuickAction[] {
  const take: QuickAction = { label: 'Prendre en charge', icon: 'pi pi-play', status: 'in_progress', assignToMe: true }
  const done: QuickAction = { label: 'Marquer traitée', icon: 'pi pi-check', status: 'done' }
  const dismiss: QuickAction = { label: 'Classer sans suite', icon: 'pi pi-ban', status: 'dismissed' }
  const reopen: QuickAction = { label: 'Rouvrir', icon: 'pi pi-replay', status: 'new' }

  switch (status) {
    case 'new':
      return [take, done, dismiss]
    case 'in_progress':
      return [done, dismiss]
    default:
      return [reopen]
  }
}

/** Page d'une fiche liée à une demande (un bordereau s'ouvre sur son devis). */
export function linkRoute(link: Pick<ClientRequestLink, 'type' | 'target_id' | 'quote_id'>): { name: string; params: { id: number } } {
  switch (link.type) {
    case 'delivery_note':
      return { name: 'quote', params: { id: link.quote_id ?? 0 } }
    case 'invoice':
      return { name: 'invoice', params: { id: link.target_id } }
    case 'quote':
      return { name: 'quote', params: { id: link.target_id } }
    case 'project':
      return { name: 'project', params: { id: link.target_id } }
    default:
      return { name: 'task', params: { id: link.target_id } }
  }
}
