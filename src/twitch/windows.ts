/**
 * The Helix clips endpoint sorts by view count and stops paginating past ~1000
 * results, so the only way to enumerate a whole channel is to query it through
 * time windows small enough to stay under that cap.
 */
export interface DateWindow {
  /** RFC3339, inclusive. */
  startedAt: string
  /** RFC3339, exclusive in practice. */
  endedAt: string
}

/**
 * The whole extent a search covers, in epoch milliseconds — what the windows
 * above are cut out of. Not a `DateWindow`: nothing sends it to Twitch, it is
 * read against the clock by whoever draws the run.
 */
export interface Span {
  from: number
  to: number
}

/** Twitch rejects the fractional seconds produced by `toISOString()`. */
function toRfc3339(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Seeds a search with a single window over the whole period.
 *
 * The seed used to be cut on calendar years, to spare the bisection tree its
 * top levels: a saturated window costs ten requests before it can be halved,
 * and the halves refetch what it just read. That toll is real. It is also the
 * wrong thing to optimise, because a narrower window does not merely cost less
 * — it **returns less**.
 *
 * Measured on 2026-09-20, `kaliyami` over 2025, same page size, same span:
 *
 *   · one window        — 3 requests, 253 clips
 *   · four (quarters)   — 4 requests, 249
 *   · twelve (months)   — 12 requests, 249
 *
 * The twelve rendered the very same 249 as the four, and neither ever returned
 * a clip the single window had missed: a finer cut is a strict subset. The four
 * lost clips sat at 1, 2, 5 and 9 views, far from any boundary — the tail, not
 * the seams. Helix under-delivers on a narrow date range, which is
 * twitchdev/issues#48, open since 2020.
 *
 * So the seed is as wide as the period, and only saturation buys a cut. The
 * toll the year boundaries used to avoid is still paid, but it is no longer
 * paid for nothing: a saturated parent hands back the most complete view of the
 * top of its own span, and `collectClips` keeps every clip of it.
 */
export function seedWindows(start: Date, end: Date): DateWindow[] {
  if (!(end.getTime() > start.getTime())) return []

  return [{ startedAt: toRfc3339(start), endedAt: toRfc3339(end) }]
}

/** Halves a window, or returns null when the halves would fall below `minMs`. */
export function bisect(window: DateWindow, minMs: number): [DateWindow, DateWindow] | null {
  const startMs = Date.parse(window.startedAt)
  const endMs = Date.parse(window.endedAt)
  if (endMs - startMs < 2 * minMs) return null

  const middle = toRfc3339(new Date(startMs + Math.floor((endMs - startMs) / 2)))
  return [
    { startedAt: window.startedAt, endedAt: middle },
    { startedAt: middle, endedAt: window.endedAt },
  ]
}
