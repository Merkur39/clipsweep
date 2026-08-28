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

/** What `splitByYear` seeds a long search with: one window per calendar year. */
const years = (n: number, from = 2018): DateWindow[] =>
  Array.from({ length: n }, (_, i) => ({
    startedAt: `${from + i}-01-01T00:00:00Z`,
    endedAt: `${from + i + 1}-01-01T00:00:00Z`,
  }))

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

    const { clips, requests } = await collectClips({ windows: [twoDays], fetchPage })

    expect(clips.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(requests).toBe(2)
    expect(fetchPage).toHaveBeenLastCalledWith(twoDays, 'p2')
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

    await collectClips({ windows: [firstHalf, secondHalf], fetchPage, onProgress })

    expect(onProgress).toHaveBeenLastCalledWith({
      windowsDone: 2,
      windowsTotal: 2,
      coveredMs: TWO_DAYS_MS,
      periodMs: TWO_DAYS_MS,
      clipsFound: 1,
      requests: 2,
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
