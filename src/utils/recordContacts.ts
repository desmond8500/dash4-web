import type { Contact, RecordContact } from '@dash4/shared'

/** Rôles proposés à la saisie (on peut en taper un autre). */
export const CONTACT_ROLES = [
  "Maître d'ouvrage",
  "Maître d'œuvre",
  'Architecte',
  'Bureau de contrôle',
  'Responsable technique',
  'Responsable sécurité',
  'Responsable sur place',
  'Signataire',
  'Comptabilité',
]

/** Contacts du client qui ne sont pas encore liés à la fiche, par ordre alphabétique. */
export function unlinkedContacts(contacts: Contact[], linked: RecordContact[]): Contact[] {
  const ids = new Set(linked.map((l) => l.contact.id))
  return contacts.filter((c) => !ids.has(c.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'))
}

/** Ligne sous le nom : fonction, société (ou client), pour reconnaître le contact. */
export function contactSubtitle(contact: Pick<Contact, 'job_title' | 'company' | 'client'>): string {
  return [contact.job_title, contact.company || contact.client?.name].filter(Boolean).join(' · ')
}

/** Tous les numéros et adresses du contact, sans doublon (champ principal puis listes). */
export function contactChannels(contact: Pick<Contact, 'phone' | 'email' | 'phones' | 'emails'>): { phones: string[]; emails: string[] } {
  const unique = (values: Array<string | null | undefined>) => [...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))]
  return {
    phones: unique([contact.phone, ...(contact.phones ?? []).map((p) => p.number)]),
    emails: unique([contact.email, ...(contact.emails ?? []).map((e) => e.address)]),
  }
}

/** Nouvel ordre des liens après avoir déplacé l'un d'eux d'une place. */
export function movedIds(links: Array<Pick<RecordContact, 'id'>>, index: number, direction: -1 | 1): number[] {
  const ids = links.map((l) => l.id)
  const target = index + direction
  if (target < 0 || target >= ids.length) return ids
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  return ids
}
