import { claimedOffset } from './cursor'
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
/** The ceiling Helix allows, and what a sweep asks for until a gap shows up. */
export const DEFAULT_PAGE_SIZE = 100
/**
 * What a window is read again at once its cursor admits a gap.
 *
 * Measured on 2026-09-20, `vinc33x`: at `first=100` the three pages served 98,
 * 98 and 61 clips against cursors reading 100 and 200 — four withheld, 257 in
 * hand. The same window at `first=20` served all fourteen pages full: 261
 * clips, the site's own count, and a deficit of nought on every page.
 */
export const DEFAULT_RESCUE_PAGE_SIZE = 20

export type ClipPageFetcher = (
  window: DateWindow,
  cursor: string | undefined,
  first: number,
) => Promise<ClipPage>

export interface WindowReport {
  window: DateWindow
  depth: number
  clipCount: number
  /** Hit the result cap with pages still pending — some clips were unreachable. */
  saturated: boolean
  /** Saturated *and* small enough to be halved, so the gap gets covered. */
  split: boolean
  /**
   * Clips Helix counted as served and did not hand over — see [claimedOffset].
   *
   * Read at each cursor and kept at its highest, rather than subtracted once at
   * the end: the last page of a window carries no cursor, so the final offset
   * lags the clips in hand and the difference would read as nought. Measured on
   * 2026-09-20, `vinc33x` at `first=100`: 2 after the first page, 4 after the
   * second, and the sweep ended exactly four short of the site's own index.
   *
   * It is a floor, not a total: a window whose every page served what it
   * claimed can still be missing clips the service never counted at all.
   *
   * What is left after the buy-back, when there was one: the residual is what
   * the reader needs, not what the first and coarser pass happened to see.
   */
  unreachable: number
  /**
   * Clips the buy-back brought back, or null when the window never needed one.
   *
   * The two are worth telling apart: nothing recovered from a window that was
   * read twice says the smaller pages found nothing more, where a window never
   * read twice simply never admitted to a gap.
   */
  recovered: number | null
}

export interface CollectResult {
  clips: Clip[]
  reports: WindowReport[]
  /** Saturated windows that could not be split: their surplus clips are lost. */
  incomplete: WindowReport[]
  /**
   * Clips the service counted as served and withheld, summed over the windows
   * that were walked to the end.
   *
   * Split windows are left out on purpose, like `coveredMs` leaves them out:
   * their halves walk the very span they walked, and would count the same gap
   * twice.
   */
  unreachable: number
  requests: number
}

export interface CollectClipsOptions {
  windows: DateWindow[]
  fetchPage: ClipPageFetcher
  pageCap?: number
  minWindowMs?: number
  /** What a window is asked for first. */
  pageSize?: number
  /** What a window admitting a gap is read again at; no buy-back above it. */
  rescuePageSize?: number
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
  pageSize = DEFAULT_PAGE_SIZE,
  rescuePageSize = DEFAULT_RESCUE_PAGE_SIZE,
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

  /**
   * One pass over a window, at the page size it is asked for. Runs twice on a
   * window that admits a gap, which is why it is a function.
   */
  const walk = async (window: DateWindow, first: number) => {
    let cursor: string | undefined
    let collected = 0
    let saturated = false
    let unreachable = 0

    for (;;) {
      const page = await fetchPage(window, cursor, first)
      requests += 1
      for (const clip of page.clips) byId.set(clip.id, clip)
      collected += page.clips.length
      cursor = page.cursor
      // What the next request will skip over. Helix serves fewer clips than the
      // offset it hands back, says nothing about it, and starts the next page
      // past them all the same.
      const claimed = claimedOffset(cursor)
      if (claimed !== null) unreachable = Math.max(unreachable, claimed - collected)
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

    return { collected, saturated, unreachable }
  }

  while (queue.length > 0 && !signal?.aborted) {
    const { window, depth } = queue.shift()!
    let { collected, saturated, unreachable } = await walk(window, pageSize)
    let recovered: number | null = null

    // The buy-back. A cursor claiming more than the page delivered names the
    // clips the next request is about to skip, and smaller pages are where they
    // come back — the whole window again, since the gap sits at page borders
    // whose position is precisely what changes.
    //
    // Only a window walked to the end earns it. A saturated one is about to be
    // halved, and its two halves will walk this very span again, each buying
    // back its own share; paying here would pay twice for the same ground.
    if (!saturated && unreachable > 0 && rescuePageSize < pageSize && !signal?.aborted) {
      const before = byId.size
      const again = await walk(window, rescuePageSize)
      recovered = byId.size - before
      // The second pass read the same window more completely, so it is the one
      // that describes it — its rows, its saturation, and the gap IT still
      // could not close.
      collected = again.collected
      saturated = again.saturated
      unreachable = again.unreachable
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
      unreachable,
      recovered,
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
    unreachable: reports
      .filter((report) => !report.split)
      .reduce((total, report) => total + report.unreachable, 0),
    requests,
  }
}
