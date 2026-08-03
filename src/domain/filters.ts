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

/** A clip's day, as the Date column shows it. */
const day = (clip: Clip) => clip.created_at.slice(0, 10)

/** Filtering only: ordering belongs to `sortClips`, which the user drives. */
export function applyFilters(clips: Clip[], filters: ClipFilters): Clip[] {
  // Sets rather than includes(): the creator facet can hold hundreds of values
  // and this runs against the whole catalogue on every keystroke.
  const creators = new Set(filters.creators)
  const gameIds = new Set(filters.gameIds)

  const kept = clips.filter((clip) => {
    if (filters.minViews !== null && clip.view_count < filters.minViews) return false
    if (filters.maxViews !== null && clip.view_count > filters.maxViews) return false
    // Compared against the displayed day, not the timestamp: `created_at` carries
    // a time the table does not show, and a clip from 23:30 must stay inside the
    // range whose end date its own row displays. In `yyyy-mm-dd`, lexicographic
    // order is chronological order.
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
 * The actual extent of the collected clips, to bound the range fields.
 *
 * It comes from the clips, not from the period swept: a sweep started in 2019
 * over a channel created in 2021 would otherwise offer two years of dates none
 * of which can return anything. Same stance as [facets], which drops empty
 * values.
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
