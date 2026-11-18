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

/** Initiales affichées quand le client n'a pas de logo : « Société Générale » → « SG ». */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

export const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

/** Vérifie un logo avant l'envoi (l'API refait la même vérification). Renvoie le message d'erreur, ou null. */
export function logoError(file: { type: string; size: number }): string | null {
  if (!LOGO_TYPES.includes(file.type)) return 'Le logo doit être une image JPEG, PNG ou WebP.'
  if (file.size > LOGO_MAX_BYTES) return 'Le logo ne peut pas dépasser 2 Mo.'
  return null
}
