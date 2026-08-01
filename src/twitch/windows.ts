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

/** Twitch rejects the fractional seconds produced by `toISOString()`. */
export function toRfc3339(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function windowDurationMs(window: DateWindow): number {
  return Date.parse(window.endedAt) - Date.parse(window.startedAt)
}

/**
 * Seeds a search with one window per calendar year.
 *
 * A saturated window costs ten requests before it can be halved, and those are
 * pure toll: the halves refetch the same clips. Starting from a single window
 * over the whole range makes every internal node of the bisection tree pay it —
 * roughly three times the requests of a well-sized start. Year boundaries lop
 * off the top levels, which are the expensive ones, without asking the user for
 * a number or probing the API for a density it cannot report.
 */
export function splitByYear(start: Date, end: Date): DateWindow[] {
  const endMs = end.getTime()
  if (!(endMs > start.getTime())) return []

  const windows: DateWindow[] = []
  for (let cursor = start.getTime(); cursor < endMs;) {
    const nextYear = Date.UTC(new Date(cursor).getUTCFullYear() + 1, 0, 1)
    const boundary = Math.min(nextYear, endMs)
    windows.push({
      startedAt: toRfc3339(new Date(cursor)),
      endedAt: toRfc3339(new Date(boundary)),
    })
    cursor = boundary
  }
  return windows
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
