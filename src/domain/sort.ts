import type { Clip } from '../twitch/types'

export type SortKey = 'views' | 'date' | 'title' | 'creator'
export type SortDirection = 'asc' | 'desc'

export interface ClipSort {
  key: SortKey
  direction: SortDirection
}

/** Least-viewed first: that is the whole point of the tool. */
export const DEFAULT_SORT: ClipSort = { key: 'views', direction: 'asc' }

/**
 * One instance, reused: calling `localeCompare` on every comparison would
 * rebuild the collator tens of thousands of times. `sensitivity` ignores case
 * and accents — without it "Élodie" lands after "Zoé" — and `numeric` orders
 * "Clip 2" before "Clip 10".
 */
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function comparePrimary(a: Clip, b: Clip, key: SortKey): number {
  switch (key) {
    case 'views':
      return a.view_count - b.view_count
    // Dates are ISO strings: their lexicographic order is their chronological
    // order, so no parsing is needed.
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
    // Tie-break always ascending: thousands of clips share the same value, and
    // their relative order must stay put from one render to the next.
    return primary || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}

/** New column: ascending. Same column: flip it. */
export function nextSort(current: ClipSort, key: SortKey): ClipSort {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}
