import type { Clip, ClipPage, Progress } from './types'
import { bisect, type DateWindow } from './windows'

/**
 * Helix stops paginating past ~1000 results for a single clips query. We cut a
 * little under it: a window sitting exactly on the boundary is indistinguishable
 * from one that got truncated.
 */
export const DEFAULT_PAGE_CAP = 950
/** Below six hours, splitting costs more requests than the clips it recovers. */
export const DEFAULT_MIN_WINDOW_MS = 6 * 3_600_000

export type ClipPageFetcher = (window: DateWindow, cursor: string | undefined) => Promise<ClipPage>

export interface WindowReport {
  window: DateWindow
  depth: number
  clipCount: number
  /** Hit the result cap with pages still pending — some clips were unreachable. */
  saturated: boolean
  /** Saturated *and* small enough to be halved, so the gap gets covered. */
  split: boolean
}

export interface CollectResult {
  clips: Clip[]
  reports: WindowReport[]
  /** Saturated windows that could not be split: their surplus clips are lost. */
  incomplete: WindowReport[]
  requests: number
}

export interface CollectClipsOptions {
  windows: DateWindow[]
  fetchPage: ClipPageFetcher
  pageCap?: number
  minWindowMs?: number
  onProgress?: (progress: Progress) => void
  onWindow?: (report: WindowReport) => void
  /**
   * The clips known after each period, already deduplicated — the table fills in
   * as it goes rather than staying empty for the whole search.
   */
  onClips?: (clips: Clip[]) => void
  signal?: AbortSignal
}

/**
 * Walks every window, following cursors, and halves any window that saturates —
 * otherwise the tail of the view-count ordering (the least viewed clips) stays
 * unreachable. Halves are explored depth-first so the timeline fills in order.
 */
export async function collectClips({
  windows,
  fetchPage,
  pageCap = DEFAULT_PAGE_CAP,
  minWindowMs = DEFAULT_MIN_WINDOW_MS,
  onProgress,
  onWindow,
  onClips,
  signal,
}: CollectClipsOptions): Promise<CollectResult> {
  const queue: { window: DateWindow; depth: number }[] = windows.map((window) => ({
    window,
    depth: 0,
  }))
  const byId = new Map<string, Clip>()
  const reports: WindowReport[] = []
  let windowsDone = 0
  let windowsTotal = queue.length
  let requests = 0

  // Summed from the seed windows themselves rather than from the bounds the
  // search was asked for. The two coincide on the path the application takes,
  // both ends of a period landing on a whole second — but `toRfc3339` drops the
  // milliseconds off every window it emits, so a denominator read from the raw
  // bounds is one the numerator has no way of reaching. A bar stopping a
  // millisecond short of its end never reads as finished, and nothing would
  // show it until a caller passed bounds carrying milliseconds.
  const spanOf = (window: DateWindow) => Date.parse(window.endedAt) - Date.parse(window.startedAt)
  const periodMs = windows.reduce((total, window) => total + spanOf(window), 0)
  let coveredMs = 0

  // Said before the first request rather than after the first window: a window
  // is a calendar year, and a dense one costs ten sequential requests before it
  // can report anything. Until it does, a bar with no denominator has nothing
  // to draw and a reader has nothing to read — over the longest stretch of the
  // whole search.
  onProgress?.({
    windowsDone: 0,
    windowsTotal,
    coveredMs: 0,
    periodMs,
    clipsFound: 0,
    requests: 0,
  })

  while (queue.length > 0 && !signal?.aborted) {
    const { window, depth } = queue.shift()!
    let cursor: string | undefined
    let collected = 0
    let saturated = false

    for (;;) {
      const page = await fetchPage(window, cursor)
      requests += 1
      for (const clip of page.clips) byId.set(clip.id, clip)
      collected += page.clips.length
      cursor = page.cursor
      // The count is the figure the run block is built around, and a window is
      // far too coarse to move it: it would sit at zero for a whole year of
      // clips, which reads as a search that found nothing rather than one that
      // has not answered yet. The pages are what land, so the pages report.
      //
      // Only the counters, though — the clips themselves still come out one
      // window at a time, below, so the table is not re-rendered per request
      // for a handful of extra rows.
      onProgress?.({
        windowsDone,
        windowsTotal,
        coveredMs,
        periodMs,
        clipsFound: byId.size,
        requests,
      })

      if (signal?.aborted || !cursor || page.clips.length === 0) break
      if (collected >= pageCap) {
        saturated = true
        break
      }
    }

    const halves = saturated ? bisect(window, minWindowMs) : null
    if (halves) {
      // Depth-first: finish drilling into this span before the next one.
      queue.unshift(...halves.map((half) => ({ window: half, depth: depth + 1 })))
      windowsTotal += halves.length
    }

    const report: WindowReport = {
      window,
      depth,
      clipCount: collected,
      saturated,
      split: halves !== null,
    }
    reports.push(report)
    onWindow?.(report)

    // The ground the search has actually walked, and the whole reason the bar
    // can no longer slide backwards. Three cases, and the condition holds all
    // three:
    //
    //   · split — no credit. It has walked nothing that will not be walked
    //     again, and its two halves tile it exactly, so they will credit
    //     between them precisely what it did not.
    //   · saturated but too small to halve — full credit. It is a leaf. What
    //     the bar measures is the period walked, not how exhaustively; that
    //     verdict is `incomplete`'s to give, and the ticket gives it. Credited
    //     on `saturated` instead, the bar would never reach its own end.
    //   · cut short by a stop — no credit. `signal.aborted` is tested before
    //     the cap is, so an interrupted window comes back `split: false` and
    //     would otherwise take credit for a whole year at the very moment the
    //     search was called off.
    if (!report.split && !signal?.aborted) coveredMs += spanOf(window)

    windowsDone += 1
    // One period, one delivery: per-page would be finer grained, but would make
    // the table render on every request for a handful of extra rows.
    onClips?.([...byId.values()])
    onProgress?.({
      windowsDone,
      windowsTotal,
      coveredMs,
      periodMs,
      clipsFound: byId.size,
      requests,
    })
  }

  return {
    clips: [...byId.values()],
    reports,
    incomplete: reports.filter((report) => report.saturated && !report.split),
    requests,
  }
}
