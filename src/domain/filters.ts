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
  /** Free text, matched against the title. Empty means no restriction. */
  query: string
}

export const NO_FILTERS: ClipFilters = {
  minViews: null,
  maxViews: null,
  from: null,
  to: null,
  creators: [],
  gameIds: [],
  query: '',
}

/** A clip's day, as the Date column shows it. */
const day = (clip: Clip) => clip.created_at.slice(0, 10)

/**
 * Text as it gets compared: lower case, and stripped of its diacritics.
 *
 * Both directions matter. A reader typing "derniere" must reach "dernière", and
 * one who does type the accent must not be punished for it — a French interface
 * where the accented spelling finds less than the flat one is a search that
 * penalises correctness.
 */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Filtering only: ordering belongs to `sortClips`, which the user drives. */
export function applyFilters(clips: Clip[], filters: ClipFilters): Clip[] {
  // Sets rather than includes(): the creator facet can hold hundreds of values
  // and this runs against the whole catalogue on every keystroke.
  const creators = new Set(filters.creators)
  const gameIds = new Set(filters.gameIds)
  // Folded once, here, rather than once per clip: this runs against the whole
  // catalogue on every keystroke.
  const query = fold(filters.query.trim())

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
    // Last, and on the title alone: the creator and the game have facets of
    // their own, where a list of real values beats a guess at a substring.
    if (query !== '' && !fold(clip.title).includes(query)) return false
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
 * It comes from the clips, not from the period searched: a search started in 2019
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

/**
 * The display range reduced to what it actually hides.
 *
 * A search opens the range on the period it covers, so both bounds are set from
 * the start without holding back a single clip. A bound that reaches past the
 * clips in hand restricts nothing, and must be named neither as the reason for
 * an empty table nor as the thing to reopen — the threshold on views, or the
 * creator, would then be the real culprit and would go unsaid.
 *
 * The judge is the extent of the clips collected, not the period searched: a search
 * over a month that only returned clips from its last week is just as unhindered
 * by a range covering the whole month.
 */
export function narrowedRange(
  range: { from: string | null; to: string | null },
  extent: DateExtent | null,
): { from: string | null; to: string | null } {
  if (!extent) return range

  return {
    from: range.from !== null && range.from > extent.first ? range.from : null,
    to: range.to !== null && range.to < extent.last ? range.to : null,
  }
}

export interface Facet {
  value: string
  count: number
}

/**
 * Distinct values and their counts, for the filter dropdowns. Empty values are
 * dropped: an option nothing can be selected by is worse than no option.
 *
 * The two lists it reads part company as soon as another filter is on. `all` is
 * everything the search turned up and settles **which options exist**; `matching`
 * is what the other filters leave standing and settles **what each is worth**.
 * A count taken from `all` would promise clips that the range on dates has
 * already ruled out — "SpiZ 584" on a range holding none of his, and an empty
 * table for reward.
 *
 * `matching` deliberately excludes the facet's own constraint, or the list would
 * erase itself: counted on its own selection, "Creators" would hold nothing but
 * the creators already checked and there would be no way left to add another.
 *
 * Spent values stay, at zero, and the order sinks them to the bottom in one
 * block. Removing them would take a checked value out of the only list it can
 * be unchecked from; sorting on the absolute count instead would scatter them
 * between the live ones, and a list hundreds long would have to be read whole
 * to find what is still worth clicking.
 */
export function facets(
  all: readonly Clip[],
  matching: readonly Clip[],
  pick: (clip: Clip) => string | undefined,
): Facet[] {
  const counts = new Map<string, number>()
  for (const clip of all) {
    const value = pick(clip)?.trim()
    if (value) counts.set(value, 0)
  }
  for (const clip of matching) {
    const value = pick(clip)?.trim()
    // `has` rather than a blind increment: `matching` is a subset of `all`, and
    // trusting that here would turn any future caller's mistake into a phantom
    // option nothing can be filtered by.
    if (value && counts.has(value)) counts.set(value, counts.get(value)! + 1)
  }

  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/**
 * The facets the caller could name, then the rest, each group keeping the order
 * it came in.
 *
 * Helix resolves most game ids to a name but not all — a category it has since
 * retired comes back from `/games` with no row at all, and the filter has only
 * the number to show for it. Sorted by count, those numbers land in the middle
 * of the names, where each one reads as a fault in the tool. At the end of the
 * list they read as what they are: the tail nothing could name.
 *
 * Kept out of [facets], which knows values and counts and has no business
 * knowing what a name is.
 */
export function namedFirst(all: Facet[], isNamed: (value: string) => boolean): Facet[] {
  const named = all.filter((facet) => isNamed(facet.value))
  // Nothing to part: hand back the very array, so a caller memoizing on it is
  // not woken by an identity that changed for nothing.
  if (named.length === 0 || named.length === all.length) return all

  return [...named, ...all.filter((facet) => !isNamed(facet.value))]
}

/**
 * The order the panel draws: live facets over spent ones, and the values
 * nothing could name at the tail of whichever block they fall in.
 *
 * Two rules that would otherwise fight. Applied to the whole list at once,
 * [namedFirst] would lift a named category the filters have emptied above an
 * unresolved id with twelve clips behind it — putting a dead row over a live
 * one, which is the very scattering the count-first order exists to prevent.
 * Liveness wins; namedness settles the rest.
 */
export function panelOrder(all: Facet[], isNamed: (value: string) => boolean): Facet[] {
  const live = all.filter((facet) => facet.count > 0)
  if (live.length === all.length) return namedFirst(all, isNamed)

  return [
    ...namedFirst(live, isNamed),
    ...namedFirst(
      all.filter((facet) => facet.count === 0),
      isNamed,
    ),
  ]
}

/**
 * A views threshold as its field holds it: raw text, empty while unset.
 *
 * The one parser of those two fields. [applyFilters] gets its bound from here
 * and so does the chip that reads the pair back — a second parser would let the
 * chip announce a threshold the filter does not apply, and an empty table would
 * then name the wrong culprit.
 *
 * What is not a number is no threshold, never zero: `Number('abc')` is `NaN`,
 * and a `NaN` bound compares false against every clip — the table would empty
 * itself on a typo, with nothing on screen saying why.
 */
export function parseThreshold(raw: string): number | null {
  const value = Number(raw.trim())
  return raw.trim() === '' || !Number.isFinite(value) ? null : value
}
