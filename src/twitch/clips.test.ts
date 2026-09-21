import { describe, expect, it, vi } from 'vitest'

import { collectClips } from './clips'
import type { Clip, ClipPage, Progress } from './types'
import type { DateWindow } from './windows'

const clip = (id: string, viewCount = 1, createdAt = '2024-01-01T00:00:00Z'): Clip => ({
  id,
  url: `https://clips.twitch.tv/${id}`,
  embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
  title: id,
  view_count: viewCount,
  created_at: createdAt,
  thumbnail_url: '',
  duration: 30,
  creator_name: 'someone',
  broadcaster_name: 'testchannel',
  game_id: '1',
})

const key = (w: DateWindow) => `${w.startedAt}|${w.endedAt}`

const twoDays: DateWindow = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-03T00:00:00Z' }
const firstHalf: DateWindow = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-02T00:00:00Z' }
const secondHalf: DateWindow = {
  startedAt: '2024-01-02T00:00:00Z',
  endedAt: '2024-01-03T00:00:00Z',
}
const oneHour: DateWindow = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-01T01:00:00Z' }
const TWO_DAYS_MS = 2 * 24 * 3_600_000

/** Two windows, as a caller passing its own tiling would hand them over. */
const years = (n: number, from = 2018): DateWindow[] =>
  Array.from({ length: n }, (_, i) => ({
    startedAt: `${from + i}-01-01T00:00:00Z`,
    endedAt: `${from + i + 1}-01-01T00:00:00Z`,
  }))

/** A cursor as Helix shapes it: two base64 layers around a count of items. */
const cursorAt = (offset: number) =>
  btoa(JSON.stringify({ b: null, a: { Cursor: btoa(String(offset)) } }))

/** The share of the period a report puts behind the search. */
const share = (p: Progress) => (p.periodMs === 0 ? 0 : p.coveredMs / p.periodMs)

describe('collectClips, streaming as it goes', () => {
  // A search runs from a few seconds to several minutes: holding the clips back
  // until the end leaves the table empty — and therefore lying — all that time.
  it('delivers the clips after each period, without waiting for the end', async () => {
    const pages: Record<string, ClipPage> = {
      [key(firstHalf)]: { clips: [clip('a'), clip('b')], cursor: undefined },
      [key(secondHalf)]: { clips: [clip('c')], cursor: undefined },
    }
    const onClips = vi.fn()

    await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage: async (window) => pages[key(window)],
      onClips,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(onClips.mock.calls.map(([clips]) => clips.map((c: Clip) => c.id))).toEqual([
      ['a', 'b'],
      ['a', 'b', 'c'],
    ])
  })

  // The same clip comes back from one half to the other after a split: the
  // stream must come out deduplicated, otherwise the table doubles rows then
  // removes them.
  it('streams already deduplicated', async () => {
    const pages: Record<string, ClipPage> = {
      [key(firstHalf)]: { clips: [clip('a')], cursor: undefined },
      [key(secondHalf)]: { clips: [clip('a'), clip('b')], cursor: undefined },
    }
    const onClips = vi.fn()

    await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage: async (window) => pages[key(window)],
      onClips,
    })

    expect(onClips.mock.lastCall?.[0].map((c: Clip) => c.id)).toEqual(['a', 'b'])
  })

  it('delivers the same content as the final result', async () => {
    const pages: Record<string, ClipPage> = {
      [key(firstHalf)]: { clips: [clip('a')], cursor: undefined },
      [key(secondHalf)]: { clips: [clip('b')], cursor: undefined },
    }
    const onClips = vi.fn()

    const result = await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage: async (window) => pages[key(window)],
      onClips,
    })

    expect(onClips.mock.lastCall?.[0]).toEqual(result.clips)
  })
})

describe('collectClips', () => {
  it('follows the cursor until the window is exhausted', async () => {
    const pages: ClipPage[] = [
      { clips: [clip('a'), clip('b')], cursor: 'p2' },
      { clips: [clip('c')], cursor: undefined },
    ]
    const fetchPage = vi.fn(async () => pages.shift()!)

    const { clips, requests } = await collectClips({
      windows: [twoDays],
      fetchPage,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(clips.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(requests).toBe(2)
    expect(fetchPage).toHaveBeenLastCalledWith(twoDays, 'p2', 20)
  })

  it('deduplicates clips returned by overlapping windows', async () => {
    const fetchPage = vi.fn(async () => ({ clips: [clip('a'), clip('b')] }))

    const { clips } = await collectClips({ windows: [firstHalf, secondHalf], fetchPage })

    expect(clips.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('bisects a saturated window and explores the halves depth-first', async () => {
    const fetchPage = vi.fn(async (window: DateWindow): Promise<ClipPage> => {
      if (key(window) === key(twoDays)) return { clips: [clip('a'), clip('b')], cursor: 'more' }
      if (key(window) === key(firstHalf)) return { clips: [clip('a'), clip('b')] }
      return { clips: [clip('c')] }
    })

    const { clips, reports, incomplete } = await collectClips({
      windows: [twoDays, oneHour],
      fetchPage,
      pageCap: 2,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(clips.map((c) => c.id).sort()).toEqual(['a', 'b', 'c'])
    // The halves are visited before moving on to the next top-level window.
    expect(fetchPage.mock.calls.map(([w]) => key(w))).toEqual([
      key(twoDays),
      key(firstHalf),
      key(secondHalf),
      key(oneHour),
    ])
    expect(reports.find((r) => key(r.window) === key(twoDays))).toMatchObject({
      saturated: true,
      split: true,
      depth: 0,
    })
    expect(reports.find((r) => key(r.window) === key(firstHalf))).toMatchObject({
      split: false,
      depth: 1,
    })
    expect(incomplete).toEqual([])
  })

  it('reports a window still saturated at the minimum size as incomplete', async () => {
    const fetchPage = vi.fn(async () => ({ clips: [clip('a')], cursor: 'more' }))

    const { incomplete, reports } = await collectClips({
      windows: [oneHour],
      fetchPage,
      pageCap: 1,
      minWindowMs: 3_600_000,
    })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(incomplete).toHaveLength(1)
    expect(incomplete[0]).toMatchObject({ window: oneHour, saturated: true, split: false })
    expect(reports).toEqual(incomplete)
  })

  /**
   * A window is a calendar year, and a dense one costs ten sequential requests
   * before it reports anything. Waiting for the first of them to come back
   * before saying how many there are leaves the bar with no denominator — so
   * nothing to draw — for the longest stretch of the search.
   */
  it('announces the slices it is about to walk before any page has come back', async () => {
    const onProgress = vi.fn()

    await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage: async () => ({ clips: [clip('a')] }),
      onProgress,
    })

    expect(onProgress.mock.calls[0]?.[0]).toEqual({
      windowsDone: 0,
      windowsTotal: 2,
      coveredMs: 0,
      periodMs: TWO_DAYS_MS,
      clipsFound: 0,
      requests: 0,
      pass: 'wide',
      passDone: 0,
      passTotal: null,
    })
  })

  /**
   * The count is the figure the run block is built around, and per-window
   * reporting holds it at zero for as long as a whole year takes — which reads
   * as a search that found nothing rather than one that has not answered yet.
   * The pages are what actually land, so the pages are what get reported.
   */
  it('reports each page as it lands, without waiting for the window to end', async () => {
    const pages: ClipPage[] = [
      { clips: [clip('a'), clip('b')], cursor: 'p2' },
      { clips: [clip('c')], cursor: undefined },
    ]
    const onProgress = vi.fn()

    await collectClips({
      windows: [twoDays],
      fetchPage: async () => pages.shift()!,
      onProgress,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    const seen = onProgress.mock.calls.map(([p]) => p as Progress)

    expect(seen.map((p) => [p.windowsDone, p.clipsFound, p.requests])).toEqual([
      // Seeded, then a page at a time, then the window closing behind them.
      [0, 0, 0],
      [0, 2, 1],
      [0, 3, 2],
      [1, 3, 2],
    ])
  })

  it('reports progress as windows are consumed', async () => {
    const onProgress = vi.fn()
    const fetchPage = vi.fn(async () => ({ clips: [clip('a')] }))

    await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage,
      onProgress,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(onProgress).toHaveBeenLastCalledWith({
      windowsDone: 2,
      windowsTotal: 2,
      coveredMs: TWO_DAYS_MS,
      periodMs: TWO_DAYS_MS,
      clipsFound: 1,
      requests: 2,
      pass: 'wide',
      // One request into the second window's only pass.
      passDone: 1,
      passTotal: null,
    })
  })

  /**
   * The bar is a fraction, and its denominator used to be a count of slices — a
   * count that GROWS as saturated windows are halved. Past the halfway mark the
   * fraction then shrinks: (d+1)/(T+2) < d/T whenever T < 2d, so a dense recent
   * year splitting sends the bar sliding backwards, and keeps sending it back
   * for as long as it goes on subdividing.
   *
   * The period is the denominator that cannot do that. Halves tile their parent
   * exactly — `bisect` shares one midpoint — so a split moves no ground, and
   * every leaf that lands moves it forward.
   */
  it('never reports a share of the period smaller than the one before it', async () => {
    // The sixth of eight years saturates: 5/8 = 62.5% of the slices, which the
    // split used to turn into 6/10 = 60%.
    const dense = years(8)[5]
    const shares: number[] = []

    await collectClips({
      windows: years(8),
      fetchPage: async (window) => ({
        clips: [clip(key(window))],
        cursor: key(window) === key(dense) ? 'more' : undefined,
      }),
      pageCap: 1,
      onProgress: (p) => shares.push(share(p)),
    })

    expect(shares).toEqual([...shares].sort((a, b) => a - b))
    expect(shares.at(-1)).toBe(1)
  })

  // A split moves no ground because it has walked none: its halves cover
  // between them exactly what it covered, and they say so as they land.
  it('credits a split window nothing, and its halves the whole of it', async () => {
    const seen: Progress[] = []

    await collectClips({
      windows: [twoDays],
      fetchPage: async (window) => ({
        clips: [clip(key(window))],
        cursor: key(window) === key(twoDays) ? 'more' : undefined,
      }),
      pageCap: 1,
      onProgress: (p) => seen.push(p),
    })

    const covered = seen.map((p) => p.coveredMs)
    // Seeded at nothing, and still nothing once the parent has come back.
    expect(covered.slice(0, 3)).toEqual([0, 0, 0])
    expect(covered.at(-1)).toBe(TWO_DAYS_MS)
  })

  /**
   * Saturated at the floor, where `bisect` refuses to halve any further. It is a
   * leaf, so it counts in full: the bar measures the period walked, not how
   * exhaustively it was walked — that verdict belongs to `incomplete`, and the
   * ticket gives it. Credited on `saturated` instead of on `split`, the bar
   * would never reach its own end on a dense channel.
   */
  it('credits a saturated window it could not halve', async () => {
    const seen: Progress[] = []

    await collectClips({
      windows: [oneHour],
      fetchPage: async () => ({ clips: [clip('a')], cursor: 'more' }),
      pageCap: 1,
      minWindowMs: 3_600_000,
      onProgress: (p) => seen.push(p),
    })

    expect(seen.at(-1)).toMatchObject({ coveredMs: 3_600_000, periodMs: 3_600_000 })
  })

  // Exact equality, not a rounding: both are sums of the same integer
  // milliseconds, and a bar stopping at 99.98% is a search that never ends.
  it('covers the seeded period exactly once every window has landed', async () => {
    const seeded = years(4)
    const seen: Progress[] = []

    await collectClips({
      windows: seeded,
      fetchPage: async (window) => ({
        clips: [clip(key(window))],
        cursor: key(window) === key(seeded[1]) ? 'more' : undefined,
      }),
      pageCap: 1,
      onProgress: (p) => seen.push(p),
    })

    const last = seen.at(-1)!
    // Named rather than compared to itself: two absent fields are equal too.
    expect(last.periodMs).toBe(1461 * 86_400_000) // 2018→2022, one leap year in
    expect(last.coveredMs).toBe(last.periodMs)
  })

  // Stopped mid-flight, the window was left half walked. `signal.aborted` is
  // tested before the cap is, so it comes back `split: false` — and would take
  // credit for a whole year at the very moment the search was called off.
  it('credits nothing for the window the search was stopped inside', async () => {
    const controller = new AbortController()
    const seen: Progress[] = []

    await collectClips({
      windows: years(2),
      fetchPage: async () => {
        controller.abort()
        return { clips: [clip('a')] }
      },
      signal: controller.signal,
      onProgress: (p) => seen.push(p),
    })

    expect(seen.at(-1)?.coveredMs).toBe(0)
  })

  /**
   * The gap Helix owns up to without naming it. Measured on 2026-09-20: a page
   * asked at 100 came back with 98 clips and a cursor reading 100, then 98 more
   * and a cursor reading 200. The four it kept are unreachable — the next
   * request starts past them — and the sweep that read 257 clips was exactly
   * four short of the site's own index.
   *
   * Read at each cursor and kept at its highest, never subtracted at the end: a
   * last page carries no cursor, so the final offset lags the clips in hand and
   * the difference would read as nought.
   */
  it('counts the clips a page claims to have served and did not', async () => {
    const pages: ClipPage[] = [
      { clips: [clip('a'), clip('b')], cursor: cursorAt(3) },
      { clips: [clip('c'), clip('d')], cursor: cursorAt(6) },
      { clips: [clip('e')] },
    ]
    const fetchPage = vi.fn(async () => pages.shift()!)

    // The ledger is what is under test, so the buy-back is held off by asking
    // for a rescue no smaller than the first pass — what it does with the
    // number is three tests below.
    const { reports, unreachable } = await collectClips({
      windows: [firstHalf],
      fetchPage,
      narrowPageSize: 100,
    })

    expect(reports[0].unreachable).toBe(2)
    expect(unreachable).toBe(2)
  })

  it('counts nothing unreachable when every page serves what it claims', async () => {
    const pages: ClipPage[] = [
      { clips: [clip('a'), clip('b')], cursor: cursorAt(2) },
      { clips: [clip('c')] },
    ]
    const fetchPage = vi.fn(async () => pages.shift()!)

    const { reports, unreachable } = await collectClips({
      windows: [firstHalf],
      fetchPage,
      narrowPageSize: 100,
    })

    expect(reports[0].unreachable).toBe(0)
    expect(unreachable).toBe(0)
  })

  // The ledger is a reading of Helix, not a dependency on it: a cursor it no
  // longer shapes the same way must cost the count and never the sweep.
  it('counts nothing unreachable from a cursor it cannot read', async () => {
    const pages: ClipPage[] = [
      { clips: [clip('a')], cursor: 'opaque-to-us' },
      { clips: [clip('b')] },
    ]
    const fetchPage = vi.fn(async () => pages.shift()!)

    const { clips, reports } = await collectClips({
      windows: [firstHalf],
      fetchPage,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(clips).toHaveLength(2)
    expect(reports[0].unreachable).toBe(0)
  })

  /**
   * Two passes over every window, at two page sizes far apart, unioned by id.
   * Neither size is right on its own, and measurement is what settled it:
   *
   *   · `vinc33x`, 261 clips — `first=100` returned 257 (pages of 98 for a
   *     hundred asked), `first=20` returned all 261, `first=2` returned 253
   *     out of 261 rows served, eight of them repeats.
   *   · `noxya__`, 91 clips — `first=100` returned 88 in a single page with no
   *     cursor at all, `first=2` returned all 91.
   *
   * A wide slice drops rows inside itself; a narrow one multiplies the page
   * borders, and the ordering shifts between two requests, so clips are served
   * twice and others never. The two failures answer to opposite knobs, so the
   * sweep turns both.
   */
  it('reads every window twice, at two page sizes, and unions what it finds', async () => {
    const asked: number[] = []
    const fetchPage = vi.fn(async (_w: DateWindow, cursor: string | undefined, first: number) => {
      asked.push(first)
      if (cursor) return { clips: [] }
      return first === 20
        ? { clips: [clip('wide'), clip('both')], cursor: undefined }
        : { clips: [clip('narrow'), clip('both')], cursor: undefined }
    })

    const { clips, reports } = await collectClips({ windows: [firstHalf], fetchPage })

    expect(asked).toEqual([20, 2])
    expect(clips.map((c) => c.id).sort()).toEqual(['both', 'narrow', 'wide'])
    expect(reports[0].recovered).toBe(1)
  })

  /**
   * Every window is walked wide before any is verified. A sweep over a big
   * channel bisects into hundreds of windows, and interleaving the two passes
   * made the run alternate between "searching" and "verifying" for two hours.
   * Worse, it withheld clips the wide pass could have had straight away: the
   * narrow one costs nine requests out of ten and brings back almost nothing,
   * so every minute it spends is a minute the table is not filling.
   */
  it('walks every window wide before it verifies any of them', async () => {
    const seen: string[] = []
    const fetchPage = vi.fn(async (window: DateWindow, _c: string | undefined, first: number) => {
      seen.push(`${key(window) === key(firstHalf) ? 'A' : 'B'}${first}`)
      return { clips: [clip(key(window) === key(firstHalf) ? 'a' : 'b')] }
    })

    await collectClips({ windows: [firstHalf, secondHalf], fetchPage })

    expect(seen).toEqual(['A20', 'B20', 'A2', 'B2'])
  })

  /**
   * And the second pass is owed nothing by the first. On `noxya__` the whole
   * channel came back as one page of 88 with no cursor — so nothing claimed
   * more, the ledger read nought, and three clips were missing all the same.
   * A trigger blind to the one page every window ends on cannot gate the pass
   * that repairs it.
   */
  it('reads a window again even when nothing admitted a gap', async () => {
    const asked: number[] = []
    const fetchPage = vi.fn(async (_w: DateWindow, _c: string | undefined, first: number) => {
      asked.push(first)
      return first === 20 ? { clips: [clip('a')] } : { clips: [clip('a'), clip('b')] }
    })

    const { clips, reports } = await collectClips({ windows: [firstHalf], fetchPage })

    expect(asked).toEqual([20, 2])
    expect(clips.map((c) => c.id).sort()).toEqual(['a', 'b'])
    expect(reports[0].unreachable).toBe(0)
    expect(reports[0].recovered).toBe(1)
  })

  /**
   * Whether a window still owes a second pass, said in the report rather than
   * inferred from it. A caller reading `recovered === null` cannot tell "not
   * verified yet" from "never will be" — and the difference decides when it is
   * allowed to quote the gap.
   */
  it('says whether a second pass is still owed', async () => {
    const fetchPage = vi.fn(async () => ({ clips: [clip('a')] }))

    const owed = await collectClips({ windows: [firstHalf], fetchPage })
    const settled = await collectClips({ windows: [firstHalf], fetchPage, narrowPageSize: 20 })

    expect(owed.reports[0].pending).toBe(false)
    expect(settled.reports[0].pending).toBe(false)
  })

  it('leaves a window pending until the second pass has been over it', async () => {
    const seen: boolean[] = []
    const fetchPage = vi.fn(async () => ({ clips: [clip('a')] }))

    await collectClips({
      windows: [firstHalf],
      fetchPage,
      onWindow: (report) => seen.push(report.pending),
    })

    expect(seen).toEqual([true, false])
  })

  /**
   * A row served twice is a row served in place of another: the pass that
   * repeated it skipped something. It proves that pass incomplete — never the
   * sweep, since the other pass may well hold what it missed, which is the
   * whole reason there are two.
   */
  it('counts the rows a pass served twice', async () => {
    const fetchPage = vi.fn(async (_w: DateWindow, cursor: string | undefined, first: number) => {
      if (first !== 2) return { clips: [clip('a')] }
      return cursor ? { clips: [clip('a')] } : { clips: [clip('a')], cursor: cursorAt(1) }
    })

    const { clips, reports } = await collectClips({ windows: [firstHalf], fetchPage })

    expect(clips.map((c) => c.id)).toEqual(['a'])
    expect(reports[0].duplicated).toBe(1)
  })

  it('leaves a saturated window to its halves rather than reading it twice', async () => {
    const asked: number[] = []
    const fetchPage = vi.fn(async (window: DateWindow, _c: string | undefined, first: number) => {
      asked.push(first)
      return key(window) === key(twoDays)
        ? { clips: [clip('a'), clip('b')], cursor: cursorAt(9) }
        : { clips: [clip('a')] }
    })

    const { reports } = await collectClips({
      windows: [twoDays],
      fetchPage,
      pageCap: 2,
      minWindowMs: TWO_DAYS_MS / 2,
    })

    expect(reports[0]).toMatchObject({ saturated: true, split: true, recovered: null })
  })

  // The gap can survive both passes, and then it is the second pass's residual
  // that must be reported — not the one the wider, coarser pass happened to see.
  it('reports what the second pass still could not reach', async () => {
    const fetchPage = vi.fn(async (_w: DateWindow, cursor: string | undefined, first: number) => {
      if (cursor) return { clips: [clip('c')] }
      return first === 20
        ? { clips: [clip('a')], cursor: cursorAt(9) }
        : { clips: [clip('a'), clip('x')], cursor: cursorAt(4) }
    })

    const { reports, unreachable } = await collectClips({ windows: [firstHalf], fetchPage })

    expect(reports[0].recovered).toBe(1)
    expect(reports[0].unreachable).toBe(2)
    expect(unreachable).toBe(2)
  })

  /**
   * A slice that dropped everything it held. Measured on 2026-09-20 on
   * `noxya__`: asked for five clips over one day, Helix served three and a
   * cursor reading five; the next request came back empty although two clips
   * of that day were still unserved. An empty page is the shape a fully
   * dropped slice takes, not the shape the end of a list takes — the end comes
   * with no cursor at all.
   */
  it('keeps walking when a slice comes back empty and the cursor lives on', async () => {
    const pages: ClipPage[] = [
      { clips: [clip('a')], cursor: cursorAt(2) },
      { clips: [], cursor: cursorAt(4) },
      { clips: [clip('b')] },
    ]
    const fetchPage = vi.fn(async () => pages.shift()!)

    const { clips } = await collectClips({
      windows: [firstHalf],
      fetchPage,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(clips.map((c) => c.id)).toEqual(['a', 'b'])
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  // And a floor under it, so that a service handing back cursors for ever
  // cannot hold a sweep open on nothing.
  it('gives up on a window after a run of empty pages', async () => {
    const fetchPage = vi.fn(async () => ({ clips: [], cursor: cursorAt(99) }))

    const { clips } = await collectClips({
      windows: [firstHalf],
      fetchPage,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(clips).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  /**
   * The page size the sweep asks for by default, and the whole of what stands
   * between it and the clips Helix drops. Measured the same day, same window of
   * one day: 100, 20 and 5 all returned three clips; 2 returned five.
   *
   * Not 1, which is the fragile end rather than the safe one: a slice of one
   * that drops its only row answers with an empty page, and an empty page is
   * one round of tolerance spent rather than a clip recovered.
   */
  it('asks twenty first, then two', async () => {
    const asked: number[] = []
    const fetchPage = vi.fn(async (_w: DateWindow, _c: string | undefined, first: number) => {
      asked.push(first)
      return { clips: [clip('a')] }
    })

    await collectClips({ windows: [firstHalf], fetchPage })

    expect(asked).toEqual([20, 2])
  })

  /**
   * Delivery is per page, not per window. It was per window while a window was
   * a calendar year and a sweep held a dozen of them; a sweep now seeds ONE
   * window over the whole period, so per-window delivery means the table stays
   * empty for the entire search and the reader watches a counter climb over
   * nothing.
   */
  it('delivers the clips as each page lands', async () => {
    const pages: ClipPage[] = [{ clips: [clip('a')], cursor: 'p2' }, { clips: [clip('b')] }]
    const onClips = vi.fn()

    await collectClips({
      windows: [firstHalf],
      fetchPage: async () => pages.shift() ?? { clips: [] },
      onClips,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(onClips.mock.calls.map(([c]) => (c as Clip[]).map((x) => x.id))).toEqual([
      ['a'],
      ['a', 'b'],
    ])
  })

  /**
   * Delivery climbs with the catalogue instead of following the pages.
   *
   * Every delivery costs the caller a full pass over everything it holds —
   * measured at 6,6 ms for 20 000 clips and 16,7 ms for 50 000, filters, sort
   * and facets together. Per page, a sweep over a large channel spends some
   * 32 000 of them, eight minutes of blocking work that no frame survives: the
   * table stops painting, and the stop button with it. Asking for two percent
   * of growth turns those thirty-two thousand into a few hundred and costs
   * nothing a reader can see — the count beside the bar comes from `onProgress`,
   * which still reports every page.
   */
  it('delivers on growth rather than on every page', async () => {
    let served = 0
    const fetchPage = vi.fn(async () => {
      served += 1
      return served <= 300 ? { clips: [clip(`c${served}`)], cursor: `p${served}` } : { clips: [] }
    })
    const onClips = vi.fn()

    const { clips } = await collectClips({
      windows: [firstHalf],
      fetchPage,
      onClips,
      // One pass: this fixture describes exactly the requests it expects.
      narrowPageSize: 20,
    })

    expect(clips).toHaveLength(300)
    expect(onClips.mock.calls.length).toBeLessThan(150)
    // And it starts at once: an empty table is the thing this exists to avoid.
    expect((onClips.mock.calls[0][0] as Clip[]).map((c) => c.id)).toEqual(['c1'])
  })

  /**
   * A stop keeps what the sweep already holds. The real `fetch` rejects with an
   * `AbortError` when the stop lands on a request in flight — the common case —
   * and that used to travel all the way out of `collectClips`, so the caller
   * never saw the clips it had. One window makes that the whole result.
   */
  it('keeps the clips it already holds when a request is aborted', async () => {
    const pages: ClipPage[] = [{ clips: [clip('a')], cursor: 'p2' }]
    const fetchPage = vi.fn(async () => {
      const next = pages.shift()
      if (next) return next
      throw new DOMException('Aborted', 'AbortError')
    })

    const { clips, reports } = await collectClips({
      windows: [firstHalf],
      fetchPage,
      narrowPageSize: 20,
    })

    expect(clips.map((c) => c.id)).toEqual(['a'])
    expect(reports).toHaveLength(1)
  })

  it('lets an error that is not an abort travel out', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('helix said no')
    })

    await expect(collectClips({ windows: [firstHalf], fetchPage })).rejects.toThrow('helix said no')
  })

  it('stops early when the signal is aborted', async () => {
    const controller = new AbortController()
    const fetchPage = vi.fn(async () => {
      controller.abort()
      return { clips: [clip('a')] }
    })

    const { clips } = await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage,
      signal: controller.signal,
    })

    expect(clips.map((c) => c.id)).toEqual(['a'])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
