import type { Article, Purchase, PurchaseLine, PurchaseStatus } from '@dash4/shared'
import type { Severity } from './clientRequests'

/** Quantité lisible : 2,5 · 10. */
export function formatQty(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

/** Mouvement signé : « +5 », « −2 ». */
export function signedQty(value: number): string {
  return value > 0 ? `+${formatQty(value)}` : value < 0 ? `−${formatQty(-value)}` : '0'
}

/** État du stock d'un article : rupture, bas, normal. */
export function stockState(article: Pick<Article, 'quantity' | 'min_quantity' | 'is_low'>): { label: string; severity: Severity } {
  if (article.quantity <= 0) return { label: 'Rupture', severity: 'danger' }
  if (article.is_low) return { label: 'Stock bas', severity: 'warn' }
  return { label: 'En stock', severity: 'success' }
}

export function purchaseStatusSeverity(status: PurchaseStatus): Severity {
  switch (status) {
    case 'ordered':
      return 'info'
    case 'partially_received':
      return 'warn'
    case 'received':
      return 'success'
    case 'cancelled':
      return 'contrast'
    default:
      return 'secondary'
  }
}

/** Quantités proposées à la réception : le reste à recevoir de chaque ligne. */
export function receptionDraft(lines: Pick<PurchaseLine, 'id' | 'remaining_quantity'>[]): Record<number, number> {
  return Object.fromEntries(lines.filter((l) => l.remaining_quantity > 0).map((l) => [l.id, l.remaining_quantity]))
}

/** Lignes à envoyer à l'API : seulement les quantités positives. */
export function receptionPayload(draft: Record<number, number | null>): Array<{ id: number; quantity: number }> {
  return Object.entries(draft)
    .map(([id, quantity]) => ({ id: Number(id), quantity: quantity ?? 0 }))
    .filter((l) => l.quantity > 0)
}

/** Avancement de la réception : « 6 / 10 ». */
export function receivedProgress(purchase: Pick<Purchase, 'lines'>): { received: number; ordered: number } {
  const lines = purchase.lines ?? []
  return {
    received: lines.reduce((t, l) => t + l.received_quantity, 0),
    ordered: lines.reduce((t, l) => t + l.quantity, 0),
  }
}
