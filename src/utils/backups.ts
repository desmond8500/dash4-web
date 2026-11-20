/** Taille lisible : « 12,3 Mo ». */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  const units = ['Ko', 'Mo', 'Go']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${units[unit]}`
}

/** Jours depuis la dernière sauvegarde de la base (null s'il n'y en a pas). */
export function daysSinceLast(backups: { kind: string; created_at: string }[], now: Date = new Date()): number | null {
  const last = backups.filter((b) => b.kind === 'database').map((b) => new Date(b.created_at).getTime()).sort((a, b) => b - a)[0]
  return last === undefined ? null : Math.floor((now.getTime() - last) / 86_400_000)
}
