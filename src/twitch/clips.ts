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
/**
 * How much the catalogue must grow before it is handed over again.
 *
 * Every delivery costs the caller a full pass over everything it holds —
 * measured at 6.6 ms for 20 000 clips and 16.7 ms for 50 000, filters, sort and
 * facets together. Delivered per page, a sweep over a large channel spends some
 * 32 000 of them: eight minutes of blocking work, and no frame survives it. The
 * table stops painting, and the stop button with it.
 *
 * Two percent turns those thirty-two thousand into a few hundred, and costs a
 * reader nothing: the count beside the bar is reported per page by
 * `onProgress`, which is O(1). What grows coarser is only how often the table
 * is rebuilt, and it grows coarser exactly as rebuilding it gets dearer.
 */
const DELIVERY_GROWTH = 1.02
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
 * allows 800 points a minute per user and per client ID, and a sweep comes
 * nowhere near it. Measured on 2026-09-21, `kaliyami` over 915 requests: 140 a
 * minute, a fifth of the allowance, because a request takes 357 ms and only one
 * was ever in flight. Time is what pays, and latency is what it pays to.
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
/**
 * How many windows the narrow pass reads at once — see `narrowConcurrency`.
 *
 * The gate in `api.ts` is what actually bounds the rate; this only decides how
 * much of it gets used. At 85 ms a slot no sweep passes 706 requests a minute
 * however many workers ask, so the figure cannot run away — which is why it can
 * be set by what the link gives rather than by what the quota tolerates.
 *
 * Four sits almost exactly on that ceiling at the latency measured on
 * 2026-09-21: 357 ms a request, so four in flight ask for 11,2 a second against
 * the 11,8 the gate hands out. Three left a quarter of the gate unused — the
 * pool ran at 1,79 in flight on average, windows being uneven enough that a
 * worker idles while another finishes a long one. Should Twitch ever answer
 * quicker, the gate takes over and holds the rate where it is.
 */
export const DEFAULT_NARROW_CONCURRENCY = 4

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
  /**
   * A second pass is still owed to this window.
   *
   * A window reports twice — once leaving the wide pass, once verified — so a
   * reader of the first report cannot tell what is settled from what is about
   * to change. `recovered === null` does not answer it either: it reads the
   * same whether the narrow pass has not run yet or will never run, and a sweep
   * that leaves it disarmed makes the first report the last one. So the report
   * says it outright, and whoever quotes the gap waits for the window's last
   * word.
   */
  pending: boolean
  /**
   * A request for this window could not be made, so some of it was never read.
   *
   * Six attempts with exponential backoff stand behind every one of these, so
   * reaching it means a page is genuinely out of reach rather than slow. The
   * error used to travel out and end the sweep on the spot: the windows after
   * it were never walked at all, and the caller's `catch` ran instead of its
   * success path, so the summary, the verdict and the game names were lost
   * along with them. A channel is not unreadable because one of its slices is.
   *
   * Kept apart from `saturated`, which says the opposite thing — that the
   * window was read right up to a cap it should have been split under. Both
   * land in `incomplete`, because both mean clips are missing, and the reader
   * is owed that either way.
   */
  failed: boolean
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
  /**
   * How many windows the second pass reads at the same time.
   *
   * Windows parallelise; the pages inside one do not. A walk advances by the
   * cursor the last page carried, so a second request sent before that page
   * lands would start from a stale offset and skip whatever lies between them —
   * the one way this could cost a clip, and the reason the pool stops at the
   * window. The first pass stays serial for its own reasons: its queue is fed
   * by the bisection as it goes, it credits `coveredMs`, and the order it
   * reports in is the axis the timeline is drawn on.
   *
   * Measured on 2026-09-21, `kaliyami`, 2 668 clips: one request in flight at
   * any moment out of a quota allowing thirteen a second, 357 ms each, the link
   * idle 15 % of the time — and the narrow pass holding twelve of the fourteen
   * minutes the sweep took.
   */
  narrowConcurrency?: number
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
  narrowConcurrency = DEFAULT_NARROW_CONCURRENCY,
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
  let delivered = 0

  /** Hands the catalogue over, if it has grown enough to be worth the pass. */
  const deliver = () => {
    if (byId.size < Math.max(delivered + 1, Math.ceil(delivered * DELIVERY_GROWTH))) return
    delivered = byId.size
    onClips?.([...byId.values()])
  }
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
  const walk = async (window: DateWindow, first: number, scope: 'window' | 'pass') => {
    // The wide pass counts per window because it cannot count otherwise: how
    // many requests a window costs is exactly what walking it finds out. The
    // narrow pass knows its whole bill before it starts, so it is counted once
    // for the pass.
    if (scope === 'window') {
      pass = 'wide'
      passDone = 0
      passTotal = null
    }
    const ids = new Set<string>()
    let cursor: string | undefined
    let collected = 0
    let saturated = false
    let unreachable = 0
    let emptyRun = 0
    let failed = false

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
        // The one failure that still ends everything. The token is gone, so
        // every window after this would fail the same way, and the interface
        // has an offer to make that a slice-by-slice report would bury.
        //
        // Matched on the name rather than on the class, as the abort above is:
        // the client that raises it imports this module, so naming its type
        // here would close the circle.
        if ((cause as Error).name === 'TokenRejectedError') throw cause
        // Anything else costs this window and no more. Swallowing a programming
        // mistake along with a dead socket is the price, and it is the cheaper
        // side of the trade: a sweep is minutes of network, the tests are where
        // a bug of ours is caught, and the window says out loud that it failed.
        failed = true
        break
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
      // Not per window, as it was while a window was a calendar year and a
      // sweep held a dozen of them: a sweep now seeds ONE window over the whole
      // period, so per window means an empty table for the length of the search
      // and nothing at all to show for a stop. Not per page either — see
      // `DELIVERY_GROWTH`.
      deliver()
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

    return { ids, collected, saturated, unreachable, failed }
  }

  /** What the wide pass leaves for the narrow one, once it has walked it all. */
  const toVerify: { report: WindowReport; wideIds: Set<string> }[] = []

  // ── First pass, wide, over every window ───────────────────────────────────
  while (queue.length > 0 && !signal?.aborted) {
    const { window, depth } = queue.shift()!
    const wide = await walk(window, pageSize, 'window')
    const { saturated, unreachable } = wide
    const clipCount = wide.ids.size
    const duplicated = wide.collected - wide.ids.size
    const recovered: number | null = null

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
      // A saturated window is not verified. One about to be halved would pay
      // for a span its two halves walk again; one saturated at the floor has
      // already lost clips to the cap, and the narrow pass counts rows against
      // that same cap — it would spend ten times the requests to stop in the
      // same place.
      pending: !saturated && narrowPageSize < pageSize,
      failed: wide.failed,
    }
    reports.push(report)
    onWindow?.(report)
    if (report.pending) toVerify.push({ report, wideIds: wide.ids })

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

  // ── Second pass, narrow, once the table is as full as the wide pass can
  // make it ──────────────────────────────────────────────────────────────────
  //
  // Deliberately after all of them, and not window by window. The two passes
  // fail in opposite ways — a wide slice drops rows inside itself, a narrow one
  // multiplies the page borders where the ordering shifts — so both have to
  // run; but the narrow one costs nine requests out of ten and brings back
  // almost nothing (0 clips of 261 on `vinc33x`, 1 of 91 on `noxya__`).
  // Interleaved, it held back clips the wide pass already had, and made a sweep
  // over a big channel alternate between searching and verifying for two hours.
  pass = 'narrow'
  passDone = 0
  // One request per page of what the wide pass counted, summed over every
  // window owed a second look: the bar draws one fraction for the whole of the
  // long stretch instead of running to full and dropping back once per window.
  // The floor is not a rounding detail — a window the wide pass found empty
  // budgets nought pages and still costs the one request that finds that out,
  // so without it the numerator would overtake its denominator.
  passTotal = toVerify.reduce(
    (total, { wideIds }) => total + Math.max(1, Math.ceil(wideIds.size / narrowPageSize)),
    0,
  )

  let next = 0
  // The first failure stops the others rather than leaving them to fetch on
  // behind a search that has already given up. `Promise.all` would reject on it
  // straight away and leave its siblings running detached, so the workers are
  // told to stop and the error is raised once they all have.
  let failure: unknown = null

  const verify = async ({ report, wideIds }: (typeof toVerify)[number]) => {
    const narrow = await walk(report.window, narrowPageSize, 'pass')
    report.recovered = [...narrow.ids].filter((id) => !wideIds.has(id)).length
    report.clipCount = new Set([...wideIds, ...narrow.ids]).size
    report.duplicated += narrow.collected - narrow.ids.size
    // The narrow pass's own residual, not the wide one's: reporting the figure
    // the second pass was run to correct would quote a stale gap.
    report.unreachable = narrow.unreachable
    // Saturating here is not halved. The window has already been credited and
    // reported as walked, and its halves would have to be walked wide as well,
    // which is a second sweep rather than a second pass. It is said instead:
    // `incomplete` takes it, and the ticket says so.
    report.saturated = report.saturated || narrow.saturated
    // Never cleared by a second pass that went well: the wide pass is what
    // read this window at the size that finds clips, and nothing says the page
    // it never got held what the narrow one found.
    report.failed = report.failed || narrow.failed
    report.pending = false
    onWindow?.(report)
    // Only when it brought something back. A pass that found nothing new would
    // otherwise cost a full rebuild of the table per window, at the very moment
    // the catalogue is at its largest, for no clip at all.
    //
    // Not routed through `deliver()`, which could not see this: a single clip
    // rescued out of 2 662 leaves the catalogue far short of the two percent
    // growth a delivery waits for, and the table would keep the rescue hidden
    // until the search ended.
    if (report.recovered > 0) onClips?.([...byId.values()])
  }

  await Promise.all(
    // Never nought. `Array.from({ length: 0 })` is an empty array and not an
    // error, so a caller passing 0 would skip the whole pass in silence and
    // lose whatever it was going to rescue — the one failure this file exists
    // to prevent, arriving through a knob meant to buy time.
    Array.from({ length: Math.max(1, Math.min(narrowConcurrency, toVerify.length)) }, async () => {
      while (!signal?.aborted && failure === null) {
        const index = next
        next += 1
        if (index >= toVerify.length) break
        try {
          await verify(toVerify[index])
        } catch (cause) {
          failure = cause
        }
      }
    }),
  )
  if (failure !== null) throw failure

  return {
    clips: [...byId.values()],
    reports,
    incomplete: reports.filter((report) => (report.saturated || report.failed) && !report.split),
    unreachable: reports
      .filter((report) => !report.split)
      .reduce((total, report) => total + report.unreachable, 0),
    requests,
  }
}
