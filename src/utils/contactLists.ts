import type { Email, EmailInput, Phone, PhoneInput } from '@dash4/shared'

/** Ligne éditable d'un formulaire (numéro de téléphone ou adresse e-mail supplémentaire). */
export interface ListRow {
  label: string
  value: string
}

export function phonesToRows(phones: Phone[] | undefined): ListRow[] {
  return (phones ?? []).map((p) => ({ label: p.label ?? '', value: p.number }))
}

export function emailsToRows(emails: Email[] | undefined): ListRow[] {
  return (emails ?? []).map((e) => ({ label: e.label ?? '', value: e.address }))
}

/** Retire les lignes vides et les espaces avant l'envoi à l'API. */
export function rowsToPhones(rows: ListRow[]): PhoneInput[] {
  return rows
    .filter((r) => r.value.trim() !== '')
    .map((r) => ({ label: r.label.trim() || null, number: r.value.trim() }))
}

export function rowsToEmails(rows: ListRow[]): EmailInput[] {
  return rows
    .filter((r) => r.value.trim() !== '')
    .map((r) => ({ label: r.label.trim() || null, address: r.value.trim() }))
}

/**
 * Erreurs de validation de l'API pour une liste : `phones.1.number` → { 1: message }.
 * Permet d'afficher le message sous la bonne ligne.
 */
export function rowErrors(errors: Record<string, string[]>, list: 'phones' | 'emails'): Record<number, string> {
  const result: Record<number, string> = {}
  const pattern = new RegExp(`^${list}\\.(\\d+)\\.`)
  for (const [key, messages] of Object.entries(errors)) {
    const match = pattern.exec(key)
    if (match && messages[0] && result[Number(match[1])] === undefined) result[Number(match[1])] = messages[0]
  }
  return result
}

/** Lien cliquable pour un numéro : `tel:` sans espaces. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`
}
