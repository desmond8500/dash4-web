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
  if (n.client_request_id) return { name: 'client-requests', query: { demande: n.client_request_id } }
  if (n.tech_access_request_id && n.kind === 'access_request.created') return { name: 'tech-space', query: { onglet: 'demandes' } }
  if (n.tech_share_id || n.tech_access_request_id) return { name: 'tech-space', query: { onglet: n.tech_share_id ? 'infos' : 'demandes' } }
  if (n.task_id) return { name: 'task', params: { id: n.task_id } }
  return null
}
