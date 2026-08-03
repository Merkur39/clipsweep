import type { Clip } from '../twitch/types'

export interface ClipFilters {
  minViews: number | null
  maxViews: number | null
  /** `yyyy-mm-dd`, both bounds inclusive; null means no restriction. */
  from: string | null
  to: string | null
  /** Empty means no restriction; several values are OR-ed together. */
  creators: readonly string[]
  gameIds: readonly string[]
}

export const NO_FILTERS: ClipFilters = {
  minViews: null,
  maxViews: null,
  from: null,
  to: null,
  creators: [],
  gameIds: [],
}

/** Le jour d'un clip, tel que la colonne Date l'affiche. */
const day = (clip: Clip) => clip.created_at.slice(0, 10)

/** Filtre seulement : l'ordre relève de `sortClips`, que l'utilisateur pilote. */
export function applyFilters(clips: Clip[], filters: ClipFilters): Clip[] {
  // Sets rather than includes(): the creator facet can hold hundreds of values
  // and this runs against the whole catalogue on every keystroke.
  const creators = new Set(filters.creators)
  const gameIds = new Set(filters.gameIds)

  const kept = clips.filter((clip) => {
    if (filters.minViews !== null && clip.view_count < filters.minViews) return false
    if (filters.maxViews !== null && clip.view_count > filters.maxViews) return false
    // Comparé au jour affiché, pas à l'horodatage : `created_at` porte une heure
    // que la table ne montre pas, et un clip de 23h30 doit rester dans la plage
    // dont sa ligne affiche la date de fin. En `yyyy-mm-dd`, l'ordre
    // lexicographique est l'ordre chronologique.
    if (filters.from !== null && day(clip) < filters.from) return false
    if (filters.to !== null && day(clip) > filters.to) return false
    if (creators.size > 0 && !creators.has(clip.creator_name)) return false
    if (gameIds.size > 0 && !gameIds.has(clip.game_id)) return false
    return true
  })
  return kept
}

export interface DateExtent {
  first: string
  last: string
}

/**
 * L'étendue réelle des clips récupérés, pour borner les champs de plage.
 *
 * Elle vient des clips, pas de la période scannée : un scan lancé en 2019
 * sur une chaîne créée en 2021 offrirait sinon deux années de dates dont aucune
 * ne peut rien rendre. Même parti que [facets], qui écarte les valeurs vides.
 */
export function dateExtent(clips: readonly Clip[]): DateExtent | null {
  if (clips.length === 0) return null

  let first = day(clips[0])
  let last = first
  for (const clip of clips) {
    const value = day(clip)
    if (value < first) first = value
    if (value > last) last = value
  }
  return { first, last }
}

export interface Facet {
  value: string
  count: number
}

/**
 * Distinct values and their counts, for the filter dropdowns. Empty values are
 * dropped: an option nothing can be selected by is worse than no option.
 */
export function facets(clips: readonly Clip[], pick: (clip: Clip) => string | undefined): Facet[] {
  const counts = new Map<string, number>()
  for (const clip of clips) {
    const value = pick(clip)?.trim()
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}
