import type { Clip } from '../twitch/types'

export interface ClipFilters {
  minViews: number | null
  maxViews: number | null
  /** Empty means no restriction; several values are OR-ed together. */
  creators: readonly string[]
  gameIds: readonly string[]
}

export const NO_FILTERS: ClipFilters = {
  minViews: null,
  maxViews: null,
  creators: [],
  gameIds: [],
}

/** Least viewed first — the whole point of the tool — then oldest first. */
function byViewsThenDate(a: Clip, b: Clip): number {
  return a.view_count - b.view_count || a.created_at.localeCompare(b.created_at)
}

export function applyFilters(clips: Clip[], filters: ClipFilters): Clip[] {
  // Sets rather than includes(): the creator facet can hold hundreds of values
  // and this runs against the whole catalogue on every keystroke.
  const creators = new Set(filters.creators)
  const gameIds = new Set(filters.gameIds)

  const kept = clips.filter((clip) => {
    if (filters.minViews !== null && clip.view_count < filters.minViews) return false
    if (filters.maxViews !== null && clip.view_count > filters.maxViews) return false
    if (creators.size > 0 && !creators.has(clip.creator_name)) return false
    if (gameIds.size > 0 && !gameIds.has(clip.game_id)) return false
    return true
  })
  return kept.sort(byViewsThenDate)
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
