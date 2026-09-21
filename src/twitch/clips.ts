import { claimedOffset } from './cursor'
import type { Clip, ClipPage, Progress } from './types'
import { bisect, type DateWindow } from './windows'

/**
 * Helix stops paginating past ~1000 results for a single clips query. We cut a
 * little under it: a window sitting exactly on the boundary is indistinguishable
 * from one that got truncated.
 */
export const DEFAULT_PAGE_CAP = 950
/**
 * How many empty pages in a row end a window.
 *
 * An empty page is not the end of a list — the end comes with no cursor at all.
 * It is the shape a slice takes when it dropped every row it held, and walking
 * past it is how the clips behind it are reached. The floor is there so that a
 * service handing back cursors for ever cannot hold a sweep open on nothing.
 */
const EMPTY_PAGE_TOLERANCE = 3
/** Below six hours, splitting costs more requests than the clips it recovers. */
export const DEFAULT_MIN_WINDOW_MS = 6 * 3_600_000
/**
 * How many clips a request asks for — the one knob that decides how many Helix
 * drops on the floor.
 *
 * It advances its cursor by what you asked for, never by what it served, so
 * every row a slice fails to produce is skipped for good. The wider the slice,
 * the more it drops. Measured on 2026-09-20, `noxya__`, one window of one day
 * holding five clips: `first` at 100, 20 and 5 each returned three; `first` at
 * 2 returned all five. On `vinc33x`, `first=100` returned 257 of 261, in pages
 * of 98 for a hundred asked.
 *
 * Not 1, which is the fragile end rather than the safe one: a slice of one that
 * drops its only row answers with an empty page, and an empty page buys nothing
 * — see the tolerance below.
 *
 * It costs a request per two clips. The quota is not what pays for it: Helix
 * allows 800 points a minute per user and per client ID, and the 60 ms spacing
 * holds a sweep near 330. Time is what pays.
 */
export const DEFAULT_PAGE_SIZE = 20
/**
 * What a window is read again at once its cursor admits a gap — and by default
 * nothing, the buy-back firing only under a page size larger than this one.
 *
 * It was 20 against a first pass of 100, and it worked where it fired. What it
 * cannot do is fire on the last page of a window, which carries no cursor and
 * therefore claims nothing: on `noxya__` the whole channel fitted in one such
 * page, two clips were dropped, and the ledger read nought. A trigger blind to
 * the one page every window ends on cannot be the guarantee, so the guarantee
 * moved into the page size itself and the buy-back stays for a caller that asks
 * for wider pages.
 */
export const DEFAULT_NARROW_PAGE_SIZE = 2

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
  /**
   * Rows a pass served twice, summed over the passes that ran.
   *
   * A repeat is a row served in place of another: the pass that repeated it
   * skipped something, one for one. Measured on 2026-09-20, `vinc33x` at
   * `first=2`: 261 rows served, 253 distinct, eight repeats — and eight clips
   * that pass never served. It proves THAT pass incomplete, never the sweep:
   * the other pass may hold exactly what it missed, which is the whole reason
   * there are two.
   */
  duplicated: number
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
  /** What the second pass asks for; no second pass unless it is the smaller. */
  narrowPageSize?: number
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
  narrowPageSize = DEFAULT_NARROW_PAGE_SIZE,
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
  let pass: 'wide' | 'narrow' = 'wide'
  let passDone = 0
  let passTotal: number | null = null
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
    pass,
    passDone,
    passTotal,
  })

  /**
   * One pass over a window, at the page size it is asked for. Runs twice on a
   * window that admits a gap, which is why it is a function.
   */
  const walk = async (window: DateWindow, first: number, expected: number | null) => {
    pass = expected === null ? 'wide' : 'narrow'
    passDone = 0
    passTotal = expected
    const ids = new Set<string>()
    let cursor: string | undefined
    let collected = 0
    let saturated = false
    let unreachable = 0
    let emptyRun = 0

    for (;;) {
      let page: ClipPage
      try {
        page = await fetchPage(window, cursor, first)
      } catch (cause) {
        // A stop landing on a request in flight is the common case, and the
        // real `fetch` rejects rather than resolving. Letting that out would
        // throw away every clip the sweep is holding — which, over a single
        // window, is the whole result. The loop below sees the aborted signal
        // and unwinds on its own.
        if ((cause as Error).name === 'AbortError') break
        throw cause
      }
      requests += 1
      passDone += 1
      for (const clip of page.clips) {
        byId.set(clip.id, clip)
        ids.add(clip.id)
      }
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
      // Per page, and not per window as it was while a window was a calendar
      // year and a sweep held a dozen of them. A sweep now seeds ONE window
      // over the whole period and walks it in a hundred and more requests: per
      // window means an empty table for the length of the search, and nothing
      // at all to show for a stop.
      onClips?.([...byId.values()])
      onProgress?.({
        windowsDone,
        windowsTotal,
        coveredMs,
        periodMs,
        clipsFound: byId.size,
        requests,
        pass,
        passDone,
        passTotal,
      })

      if (signal?.aborted || !cursor) break
      if (page.clips.length === 0) {
        emptyRun += 1
        if (emptyRun >= EMPTY_PAGE_TOLERANCE) break
      } else {
        emptyRun = 0
      }
      if (collected >= pageCap) {
        saturated = true
        break
      }
    }

    return { ids, collected, saturated, unreachable }
  }

  while (queue.length > 0 && !signal?.aborted) {
    const { window, depth } = queue.shift()!
    const wide = await walk(window, pageSize, null)
    let { saturated, unreachable } = wide
    let clipCount = wide.ids.size
    let duplicated = wide.collected - wide.ids.size
    let recovered: number | null = null

    // The second pass, unconditional. The two page sizes fail in opposite ways
    // — a wide slice drops rows inside itself, a narrow one multiplies the page
    // borders where the ordering shifts — so neither is right on its own and
    // nothing in the response says which one is failing here. The ledger cannot
    // gate it either: a window ending on its only page carries no cursor, so it
    // claims nothing and admits nothing, which is exactly the case that needs
    // the second pass most.
    //
    // A saturated window is the one exception: it is about to be halved, and
    // its two halves walk this very span again, each paying for its own share.
    if (!saturated && narrowPageSize < pageSize && !signal?.aborted) {
      // One request per page of what the wide pass just counted: the bar can
      // draw a fraction for the whole of the long pass.
      const narrow = await walk(window, narrowPageSize, Math.ceil(wide.ids.size / narrowPageSize))
      recovered = [...narrow.ids].filter((id) => !wide.ids.has(id)).length
      clipCount = new Set([...wide.ids, ...narrow.ids]).size
      duplicated += narrow.collected - narrow.ids.size
      saturated = saturated || narrow.saturated
      // The narrow pass's own residual, not the wide one's: reporting the
      // figure the second pass was run to correct would quote a stale gap.
      unreachable = narrow.unreachable
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
      clipCount,
      saturated,
      split: halves !== null,
      unreachable,
      recovered,
      duplicated,
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
    onProgress?.({
      windowsDone,
      windowsTotal,
      coveredMs,
      periodMs,
      clipsFound: byId.size,
      requests,
      pass,
      passDone,
      passTotal,
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
