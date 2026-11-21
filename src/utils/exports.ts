/** Périodes proposées pour les exports : mois en cours, mois dernier, trimestre, année. */
export function exportPeriods(today: Date = new Date()): { key: string; label: string; from: string; to: string }[] {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const y = today.getFullYear()
  const m = today.getMonth()
  const q = Math.floor(m / 3) * 3
  return [
    { key: 'month', label: 'Ce mois-ci', from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) },
    { key: 'last-month', label: 'Le mois dernier', from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { key: 'quarter', label: 'Ce trimestre', from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) },
    { key: 'year', label: `Année ${y}`, from: `${y}-01-01`, to: `${y}-12-31` },
    { key: 'last-year', label: `Année ${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ]
}
