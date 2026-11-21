/** Recherche et tri des listes affichées dans les fiches (client, projet). */

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Vrai si chaque mot cherché se trouve dans l'un des textes (sans tenir compte des accents ni de la casse). */
export function matchesSearch(query: string, ...texts: Array<string | number | null | undefined>): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = fold(texts.filter((t) => t !== null && t !== undefined && t !== '').join(' '))
  return words.every((w) => haystack.includes(w))
}

/** Filtre puis trie par ordre alphabétique (français, sans tenir compte des accents ni des nombres en texte). */
export function searchAndSort<T>(items: T[], query: string, label: (item: T) => string, texts: (item: T) => Array<string | number | null | undefined> = (i) => [label(i)]): T[] {
  return items
    .filter((item) => matchesSearch(query, ...texts(item)))
    .sort((a, b) => label(a).localeCompare(label(b), 'fr', { sensitivity: 'base', numeric: true }))
}

/** Filtre sans changer l'ordre (listes déjà classées par date, par exemple). */
export function searchOnly<T>(items: T[], query: string, texts: (item: T) => Array<string | number | null | undefined>): T[] {
  return items.filter((item) => matchesSearch(query, ...texts(item)))
}
