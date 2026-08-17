import type { T } from '../i18n/translate'
import type { Clip } from '../twitch/types'

/**
 * The two rankings of the statistics drawer — creators and games — reduced to
 * the same shape, because they are drawn with the same bars on the same scale:
 * the eye is meant to compare them without relearning the chart.
 */

export interface RankRow {
  /** React key. Never the label: two retired games both read "Unnamed (…)". */
  key: string
  label: string
  count: number
  /** The remainder, not a ranked entity — it takes the neutral bar. */
  rest: boolean
}

export interface Ranking {
  rows: RankRow[]
  /** Distinct values found, aggregate included: what the card's subtitle counts. */
  total: number
}

/**
 * Five, and it is a reading limit rather than a data one: past the fifth bar the
 * lengths stop being tellable apart at the width a drawer card can give them.
 */
export const RANKED = 5

/**
 * NUL cannot appear in a Twitch display name or in a Helix game id, so the
 * aggregate row can never collide with a real one on its React key.
 *
 * Built from its code point rather than written out, on the model of the
 * separators in `format.ts`: in the clear it is an invisible character, as
 * unreadable on review as it is on a diff.
 */
const REST_KEY = `${String.fromCharCode(0)}rest`

/**
 * Counts the clips by one of their fields, keeps the top five and rolls
 * everything below into a single aggregate row.
 *
 * Ties are broken on the label rather than left to insertion order: the table
 * fills in as the sweep runs, and an order that came from the arrival of the
 * clips would reshuffle the bars at every append for no reason the reader could
 * see.
 */
export function rankClips(
  clips: readonly Clip[],
  valueOf: (clip: Clip) => string,
  labelOf: (value: string) => string,
  t: T,
): Ranking {
  const tally = new Map<string, number>()
  for (const clip of clips) {
    const value = valueOf(clip)
    tally.set(value, (tally.get(value) ?? 0) + 1)
  }

  // The label is resolved once per value, not inside the comparator: `gameLabel`
  // goes through the message catalogue for every unnamed category, and a
  // comparator calls it O(n log n) times.
  const ranked: RankRow[] = [...tally].map(([value, count]) => ({
    key: value,
    label: labelOf(value),
    count,
    rest: false,
  }))
  ranked.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  const rows = ranked.slice(0, RANKED)
  const remainder = ranked.slice(RANKED)

  if (remainder.length > 0) {
    rows.push({
      key: REST_KEY,
      label: t('stats.others', { n: remainder.length }),
      count: remainder.reduce((sum, row) => sum + row.count, 0),
      rest: true,
    })
  }

  return { rows, total: ranked.length }
}

/**
 * The value the longest bar stands for.
 *
 * The aggregate is excluded rather than allowed to set the scale: it usually
 * outweighs the five put together, and letting it fix the axis would squash the
 * ranking it is the remainder of into an unreadable stub. It is not a ranked
 * entity, so it does not get to graduate the chart — which is also why it is
 * drawn in the neutral rule colour and not in the ranking's hue. Floored at one
 * so an empty ranking cannot divide by zero.
 */
export function barScale(rows: readonly RankRow[]): number {
  return Math.max(1, ...rows.filter((row) => !row.rest).map((row) => row.count))
}

/** Clamped, so the clipped aggregate still runs the full width of its track. */
export function barWidth(count: number, scale: number): string {
  return `${Math.min(100, (count / scale) * 100).toFixed(1)}%`
}
