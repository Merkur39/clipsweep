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

export function splitRange(start: Date, end: Date, chunkMs: number): DateWindow[] {
  const startMs = start.getTime()
  const endMs = end.getTime()
  if (!(endMs > startMs) || chunkMs <= 0) return []

  const windows: DateWindow[] = []
  for (let cursor = startMs; cursor < endMs; cursor += chunkMs) {
    windows.push({
      startedAt: toRfc3339(new Date(cursor)),
      endedAt: toRfc3339(new Date(Math.min(cursor + chunkMs, endMs))),
    })
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
