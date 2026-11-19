import type { Cv } from '@dash4/shared'

/** Nom proposé pour un nouveau CV : « CV », puis « CV 2 », « CV 3 »… */
export function nextCvName(existing: Pick<Cv, 'name'>[]): string {
  const names = new Set(existing.map((c) => c.name.trim().toLowerCase()))
  if (!names.has('cv')) return 'CV'
  let n = 2
  while (names.has(`cv ${n}`)) n++
  return `CV ${n}`
}

/** Initiales pour l'avatar par défaut. */
export function initials(firstname: string, lastname: string): string {
  return `${firstname.trim().charAt(0)}${lastname.trim().charAt(0)}`.toUpperCase()
}
