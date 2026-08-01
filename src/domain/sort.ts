import type { Clip } from '../twitch/types'

export type SortKey = 'views' | 'date' | 'title' | 'creator'
export type SortDirection = 'asc' | 'desc'

export interface ClipSort {
  key: SortKey
  direction: SortDirection
}

/** Les moins vus d'abord : c'est la raison d'être de l'outil. */
export const DEFAULT_SORT: ClipSort = { key: 'views', direction: 'asc' }

/**
 * Une instance unique, réutilisée : appeler `localeCompare` à chaque comparaison
 * reconstruirait le collateur des dizaines de milliers de fois. `sensitivity`
 * ignore casse et accents — sans quoi « Élodie » se retrouve après « Zoé » —
 * et `numeric` ordonne « Clip 2 » avant « Clip 10 ».
 */
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function comparePrimary(a: Clip, b: Clip, key: SortKey): number {
  switch (key) {
    case 'views':
      return a.view_count - b.view_count
    // Les dates sont des chaînes ISO : leur ordre lexicographique est leur ordre
    // chronologique, aucun parsing nécessaire.
    case 'date':
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
    case 'title':
      return collator.compare(a.title, b.title)
    case 'creator':
      return collator.compare(a.creator_name, b.creator_name)
  }
}

export function sortClips(clips: Clip[], sort: ClipSort): Clip[] {
  const sign = sort.direction === 'desc' ? -1 : 1

  return [...clips].sort((a, b) => {
    const primary = comparePrimary(a, b, sort.key) * sign
    // Départage toujours croissant : des milliers de clips partagent la même
    // valeur, et leur ordre relatif doit rester le même d'un rendu à l'autre.
    return primary || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}

/** Nouvelle colonne : croissant. Même colonne : on inverse. */
export function nextSort(current: ClipSort, key: SortKey): ClipSort {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}
