/** Numéro de compte masqué : seuls les 4 derniers caractères restent visibles. */
export function maskAccount(value: string | null): string {
  if (!value) return ''
  const compact = value.replace(/\s+/g, '')
  if (compact.length <= 4) return compact
  return `•••• ${compact.slice(-4)}`
}

/** Signature et cachet : PNG seulement (fond transparent), 2 Mo au plus. */
export function signatureImageError(file: { type: string; size: number }): string | null {
  if (file.type !== 'image/png') return "L'image doit être au format PNG (fond transparent conseillé)."
  if (file.size > 2 * 1024 * 1024) return "L'image ne peut pas dépasser 2 Mo."
  return null
}

/** Image d'une signature d'e-mail : JPEG ou PNG (le WebP est mal lu par les messageries), 1 Mo au plus. */
export function signatureEmailImageError(file: { type: string; size: number }): string | null {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return "L'image doit être au format JPEG ou PNG."
  if (file.size > 1024 * 1024) return "L'image ne peut pas dépasser 1 Mo."
  return null
}
