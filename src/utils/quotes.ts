import { QUOTE_STATUS_LABELS, QUOTE_TRANSITIONS } from '@dash4/shared'
import type { Quote, QuoteLine, QuoteLineCategory, QuoteStatus } from '@dash4/shared'
import type { Severity } from './clientRequests'

export function quoteStatusSeverity(status: QuoteStatus): Severity {
  switch (status) {
    case 'draft':
      return 'secondary'
    case 'sent':
      return 'info'
    case 'accepted':
      return 'success'
    case 'refused':
      return 'danger'
    default:
      return 'contrast'
  }
}

/** Prix unitaire et montant d'une ligne pendant la saisie (même calcul que l'API). */
export function linePrice(unitCost: number, coefficient: number, quantity: number): { unitPrice: number; total: number } {
  const unitPrice = Math.round(unitCost * coefficient)
  return { unitPrice, total: Math.round(unitPrice * quantity) }
}

export interface StatusAction {
  status: QuoteStatus
  label: string
  icon: string
  severity?: 'success' | 'danger' | 'secondary' | 'warn'
}

const ACTIONS: Record<QuoteStatus, Omit<StatusAction, 'status'>> = {
  draft: { label: 'Repasser en brouillon', icon: 'pi pi-replay', severity: 'secondary' },
  sent: { label: 'Marquer envoyé', icon: 'pi pi-send' },
  accepted: { label: 'Accepté', icon: 'pi pi-check', severity: 'success' },
  refused: { label: 'Refusé', icon: 'pi pi-times', severity: 'danger' },
  cancelled: { label: 'Annuler le devis', icon: 'pi pi-ban', severity: 'secondary' },
}

/**
 * Boutons de statut proposés : transitions permises, et « accepté » / « refusé »
 * seulement avec le droit de valider (sortir d'un devis accepté aussi).
 */
export function statusActions(quote: Pick<Quote, 'status' | 'can'>): StatusAction[] {
  if (!quote.can.update) return []
  const from = quote.status.value
  return QUOTE_TRANSITIONS[from]
    .filter((to) => quote.can.validate || (to !== 'accepted' && to !== 'refused' && from !== 'accepted'))
    .map((to) => ({ status: to, ...ACTIONS[to] }))
}

export function statusLabel(status: QuoteStatus): string {
  return QUOTE_STATUS_LABELS[status]
}

/** Coefficient lisible : 1,5 → « × 1,5 ». */
export function coefficientLabel(coefficient: number): string {
  return `× ${coefficient.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}`
}

/** Ordre des catégories pour le tri d'une section (centrale, organes, câble, accessoires, main-d'œuvre, autre). */
export const CATEGORY_ORDER: QuoteLineCategory[] = ['central', 'device', 'cable', 'accessory', 'service', 'other']

/**
 * Nouvel ordre des lignes d'une section, triées par catégorie.
 * Tri stable : dans une même catégorie, les lignes gardent leur ordre actuel.
 */
export function sortedByCategory(lines: Array<Pick<QuoteLine, 'id' | 'category'>>): number[] {
  return lines
    .map((line, index) => ({ line, index }))
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.line.category.value) - CATEGORY_ORDER.indexOf(b.line.category.value) ||
        a.index - b.index,
    )
    .map(({ line }) => line.id)
}

/** Adresses e-mail saisies (séparées par des virgules, points-virgules ou espaces). */
export function parseEmails(input: string): { valid: string[]; invalid: string[] } {
  const parts = input
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const ok = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  return { valid: parts.filter(ok).map((e) => e.toLowerCase()), invalid: parts.filter((e) => !ok(e)) }
}
