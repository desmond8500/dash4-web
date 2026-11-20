import type { Invoice, InvoiceScope, InvoiceStatus, Quote, QuoteLineCategory } from '@dash4/shared'
import type { Severity } from './clientRequests'

export function invoiceStatusSeverity(status: InvoiceStatus): Severity {
  switch (status) {
    case 'draft':
      return 'secondary'
    case 'issued':
      return 'info'
    case 'partially_paid':
      return 'warn'
    case 'paid':
      return 'success'
    default:
      return 'contrast'
  }
}

const SCOPE_CATEGORIES: Partial<Record<InvoiceScope, QuoteLineCategory[]>> = {
  equipment: ['central', 'device', 'cable'],
  equipment_accessories: ['central', 'device', 'cable', 'accessory'],
  labor: ['service'],
}

const SCOPE_NAMES: Partial<Record<InvoiceScope, string>> = {
  equipment: 'matériel',
  equipment_accessories: 'matériel et accessoires',
  labor: "main-d'œuvre",
}

const pct = (p: number) => p.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

/** Titre proposé pour une facture issue d'un devis (le même que l'API ; modifiable). */
export function defaultInvoiceTitle(scope: InvoiceScope, percent: number): string {
  if (scope === 'remainder') return 'Facture de solde'
  const name = SCOPE_NAMES[scope]
  if (percent < 100) return name ? `Facture d'acompte de ${pct(percent)} % — ${name}` : `Facture d'acompte de ${pct(percent)} %`
  return name ? `Facture — ${name}` : 'Facture'
}

/**
 * Montant hors taxes estimé avant création : lignes des sections visibles de la partie choisie,
 * remise du devis déduite, au pourcentage ; reliquat : reste à facturer.
 */
export function invoicePreview(quote: Quote, scope: InvoiceScope, percent: number): number {
  if (scope === 'remainder') return quote.remaining_to_invoice ?? 0
  const categories = SCOPE_CATEGORIES[scope]
  const sum = (quote.sections ?? [])
    .filter((s) => s.is_visible)
    .flatMap((s) => s.lines)
    .filter((l) => !categories || categories.includes(l.category.value))
    .reduce((total, l) => total + (l.line_total ?? 0), 0)
  const net = sum - Math.round((sum * quote.discount_rate) / 100)
  return percent >= 100 ? net : Math.round((net * percent) / 100)
}

/** Proposer un paiement : seulement sur une facture émise, pas encore réglée. */
export function canReceivePayment(invoice: Pick<Invoice, 'status' | 'can'>): boolean {
  return invoice.can.update && (invoice.status.value === 'issued' || invoice.status.value === 'partially_paid')
}
