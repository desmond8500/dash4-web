import type { RouteLocationRaw } from 'vue-router'
import type { AppNotification, CommentableType } from '@dash4/shared'

/** Page de chaque fiche commentée (le nom de la fiche est celui des adresses de l'API). */
const SUBJECT_ROUTES: Partial<Record<CommentableType, string>> = {
  clients: 'client',
  projects: 'project',
  quotes: 'quote',
  invoices: 'invoice',
  articles: 'article',
  brands: 'brand',
  providers: 'provider',
  purchases: 'purchase',
  tasks: 'task',
  journals: 'journal',
  vehicles: 'vehicle',
  tools: 'tool',
}

/** Où mène une notification quand on la touche, ou null. */
export function notificationTarget(n: AppNotification): RouteLocationRaw | null {
  if (n.subject_type && n.subject_id) {
    if (n.subject_type === 'client-requests') return { name: 'client-requests', query: { demande: n.subject_id } }
    if (n.subject_type === 'expenses') return { name: 'expenses' }
    if (n.subject_type === 'tech-shares') return { name: 'tech-space', query: { onglet: 'infos' } }
    const name = SUBJECT_ROUTES[n.subject_type]
    return name ? { name, params: { id: n.subject_id }, query: { onglet: 'commentaires' } } : null
  }
  if (n.kind === 'contract.due') return { name: 'contracts', query: { filtre: 'due' } }
  if (n.contract_id) return { name: 'contract', params: { id: n.contract_id } }
  if (n.vehicle_id) return { name: 'vehicle', params: { id: n.vehicle_id } }
  if (n.tool_id) return { name: 'tool', params: { id: n.tool_id } }
  if (n.client_request_id) return { name: 'client-requests', query: { demande: n.client_request_id } }
  if (n.tech_access_request_id && n.kind === 'access_request.created') return { name: 'tech-space', query: { onglet: 'demandes' } }
  if (n.tech_share_id || n.tech_access_request_id) return { name: 'tech-space', query: { onglet: n.tech_share_id ? 'infos' : 'demandes' } }
  if (n.task_id) return { name: 'task', params: { id: n.task_id } }
  if (n.invoice_id) return { name: 'invoice', params: { id: n.invoice_id } }
  if (n.kind === 'backup.failed') return { name: 'backups' }
  return null
}
