// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TokenRejectedError } from '../twitch/api'
import type { Session } from '../twitch/auth'
import type { Clip } from '../twitch/types'
import type { LogEntry } from '../domain/log'
import { useClipSearch } from './useClipSearch'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

const fetchUser = vi.fn()
const fetchGameNames = vi.fn()
const fetchPage = vi.fn()

/** The pause listener the hook hands the client, captured so a test can fire it. */
let announcePause: ((resumesAt: number | null) => void) | undefined

vi.mock('../twitch/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../twitch/api')>()),
  TwitchApi: class {
    constructor(_session: unknown, _signal: unknown, onPause?: (resumesAt: number | null) => void) {
      announcePause = onPause
    }
    fetchUser = (login: string) => fetchUser(login)
    fetchGameNames = (ids: string[]) => fetchGameNames(ids)
    clipPageFetcher = () => fetchPage
  },
}))

// jsdom exposes no real Storage here; the cache logic has tests of its own.
const remember = vi.fn()
vi.mock('../domain/channelCache', () => ({
  channelCache: { read: () => null, remember: (...args: unknown[]) => remember(...args) },
}))

const session: Session = { clientId: 'c', accessToken: 't', expiresInSeconds: 3600 }
const request = { channel: 'testchannel', since: '2026-01-01', until: '2026-01-31' }

const clip = (id: string, gameId = '1'): Clip =>
  ({
    id,
    url: `https://www.twitch.tv/testchannel/clip/${id}`,
    embed_url: '',
    broadcaster_name: 'TestChannel',
    creator_name: 'SpiZ',
    title: id,
    view_count: 1,
    created_at: '2026-01-15T00:00:00Z',
    thumbnail_url: '',
    duration: 30,
    game_id: gameId,
  }) as Clip

const channelFound = () =>
  fetchUser.mockResolvedValue({
    id: '1',
    login: 'testchannel',
    display_name: 'TestChannel',
    profile_image_url: '',
    created_at: '2017-07-10T00:00:00Z',
  })

/** Reading the log is rendering it: the entries hold messages, not strings. */
const logText = (entries: LogEntry[]) =>
  entries.map((entry) => entry.say(t)).join(String.fromCharCode(10))

/** What the resolution of the game names hands back, whole unless said otherwise. */
const gameNames = (names: Map<string, string>, incomplete = false) =>
  fetchGameNames.mockResolvedValue({ names, incomplete })

/**
 * A resolution that names exactly the ids it is asked about, for a test where
 * which request carried which game is the point.
 */
const gameCatalogue = (catalogue: Record<string, string>) =>
  fetchGameNames.mockImplementation(async (ids: string[]) => ({
    names: new Map(ids.filter((id) => id in catalogue).map((id) => [id, catalogue[id]])),
    incomplete: false,
  }))

describe('useClipSearch', () => {
  it('does not call the API without a session', async () => {
    const { result } = renderHook(() => useClipSearch(null, vi.fn()))

    await act(async () => result.current.start(request))

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('refuses an inverted date range, without a request', async () => {
    const { result } = renderHook(() => useClipSearch(session, vi.fn()))

    await act(async () => result.current.start({ ...request, since: '2026-02-01' }))

    expect(fetchUser).not.toHaveBeenCalled()
    expect(logText(result.current.logEntries)).toContain('date de début')
  })

  it('collects the clips and resolves the game names', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a'), clip('b')] })
    gameNames(new Map([['1', 'Cult of the Lamb']]))

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(2))
    expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb')
    expect(result.current.running).toBe(false)
  })

  /**
   * The creator facet is legible from the first page, the name being on the
   * clip itself. The game facet has only an id to go on, and it used to wait
   * for the whole sweep — the verification included, which is most of it on a
   * large channel — before asking what those ids were called. Every game read
   * "Unnamed" until then, which is what a retired category looks like.
   */
  it('names the games while the sweep is still running', async () => {
    channelFound()
    gameNames(new Map([['1', 'Cult of the Lamb']]))
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    fetchPage.mockImplementation(async (_w: unknown, cursor: string | undefined) => {
      if (!cursor) return { clips: [clip('a')], cursor: 'p2' }
      await held
      return { clips: [] }
    })

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    let search!: Promise<void>
    await act(async () => {
      search = result.current.start(request)
    })

    await waitFor(() => expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb'))
    expect(result.current.running).toBe(true)

    await act(async () => {
      release()
      await search
    })
  })

  /**
   * A stop used to leave the game facet with no names at all: the round that
   * named them came after the sweep, and ran on a signal the stop had already
   * aborted. The clips a stop keeps are the ones it has to show, so the names
   * already in hand stay — and nothing further is asked for.
   */
  it('keeps the names it had when the search is stopped, and asks for no more', async () => {
    channelFound()
    gameCatalogue({ '1': 'Cult of the Lamb', '2': 'Hollow Knight' })
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    fetchPage.mockImplementation(async (_w: unknown, cursor: string | undefined) => {
      if (!cursor) return { clips: [clip('a', '1')], cursor: 'p2' }
      await held
      return { clips: [clip('b', '2')] }
    })

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    let search!: Promise<void>
    await act(async () => {
      search = result.current.start(request)
    })
    await waitFor(() => expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb'))

    act(() => result.current.stop())
    await act(async () => {
      release()
      await search
    })

    expect(result.current.clips.map((c) => c.id)).toEqual(['a', 'b'])
    expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb')
    expect(fetchGameNames).toHaveBeenCalledTimes(1)
  })

  /**
   * A delivery waits for the catalogue to grow by two percent, so the last clips
   * of a sweep may arrive with its result alone — and their games, which no
   * delivery carried, have to be asked about there.
   */
  it('names the games of the last clips, which no delivery carried', async () => {
    channelFound()
    gameCatalogue({ '1': 'Cult of the Lamb', '2': 'Hollow Knight' })
    const hundred = Array.from({ length: 100 }, (_, i) => clip('c' + i, '1'))
    // A hundred delivered, then one more: 101 is short of the 102 a delivery
    // waits for. The narrow pass finds nothing, so it delivers nothing either.
    fetchPage.mockImplementation(async (_w: unknown, cursor: string | undefined, first: number) => {
      if (first !== 20) return { clips: [] }
      return cursor ? { clips: [clip('last', '2')] } : { clips: hundred, cursor: 'p2' }
    })

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(result.current.running).toBe(false))

    expect(result.current.clips).toHaveLength(101)
    expect(result.current.gameNames.get('2')).toBe('Hollow Knight')
  })

  it('warns when the channel predates the period asked for', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    expect(logText(result.current.logEntries)).toContain('hors périmètre')
  })

  /**
   * The whole point of a log that holds messages rather than strings: a search
   * that ran in one language reads in the other, without running again. It used
   * to freeze at the moment each line was written, which left French lines
   * standing under an English interface for the rest of the session.
   */
  /**
   * The gap has to be said, because it is the only place the sweep admits that
   * Helix withheld anything: a slice's own line reports a count, and a count
   * short of what the service claimed to serve looks exactly like a full one.
   *
   * The buy-back's own line is not reachable from here, and that is by design:
   * the hook takes the default page size, under which nothing smaller is worth
   * a second read — see `DEFAULT_RESCUE_PAGE_SIZE`.
   */
  it('says how many clips Twitch counted and did not hand over', async () => {
    channelFound()
    gameNames(new Map())
    const cursorAt = (offset: number) =>
      btoa(JSON.stringify({ b: null, a: { Cursor: btoa(String(offset)) } }))
    fetchPage.mockImplementation(async (_w: unknown, cursor: string | undefined) =>
      cursor ? { clips: [clip('b')] } : { clips: [clip('a')], cursor: cursorAt(4) },
    )

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(result.current.running).toBe(false))

    const log = result.current.logEntries.map((entry) => entry.say(t)).join(' ')
    // One clip served against four claimed by the cursor: three skipped.
    expect(log).toContain('3 clips que Twitch a comptés sans les rendre')
  })

  /**
   * A window reports twice — once leaving the wide pass, once verified — and
   * the timeline draws one slice per report. Appending them would draw the same
   * span twice, and say its line twice with it.
   */
  it('replaces a slice when it is verified rather than drawing it twice', async () => {
    channelFound()
    gameNames(new Map())
    fetchPage.mockImplementation(async (_w: unknown, cursor: string | undefined, first: number) =>
      cursor ? { clips: [] } : { clips: first === 20 ? [clip('a')] : [clip('a'), clip('b')] },
    )

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(result.current.running).toBe(false))

    expect(result.current.reports).toHaveLength(1)
    expect(result.current.reports[0].recovered).toBe(1)
    const log = result.current.logEntries.map((entry) => entry.say(t)).join(' | ')
    // One line for the slice, one for what verifying it brought back.
    expect(log.match(/01\/01\/2026 → 31\/01\/2026/g)).toHaveLength(2)
    expect(log).toContain('1 clip récupéré')
  })

  /**
   * A stop has to be acknowledged where the click was, and at once. Everything
   * the sweep does on the way out — the last delivery, the log — runs before
   * `running` can fall, and on a big channel the main thread has no frame to
   * spare for any of it. The button then sits there saying "stop the search",
   * which is the picture of an application that has hung.
   */
  it('says it is stopping the instant it is asked to', async () => {
    channelFound()
    gameNames(new Map())
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    fetchPage.mockImplementation(async () => {
      await held
      return { clips: [clip('a')] }
    })

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    let search!: Promise<void>
    await act(async () => {
      search = result.current.start(request)
    })

    expect(result.current.stopping).toBe(false)
    act(() => result.current.stop())
    // Before anything has been awaited: the search is still running.
    expect(result.current.stopping).toBe(true)
    expect(result.current.running).toBe(true)

    await act(async () => {
      release()
      await search
    })

    expect(result.current.stopping).toBe(false)
    expect(result.current.running).toBe(false)
  })

  it('reads in the language it is read in, not the one it ran in', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    const read = (locale: 'fr' | 'en') =>
      result.current.logEntries.map((entry) => entry.say(makeT(locale))).join(' ')
    expect(read('fr')).toContain('tranche à explorer')
    expect(read('en')).toContain('slice to explore')
  })

  /**
   * The one state the tool used to have no words for. A 429 was slept off inside
   * the client, so the search stood still for up to a minute without a word —
   * indistinguishable, from the outside, from a search that had hung.
   */
  it('surfaces the pause Twitch asks for, and writes it down', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(announcePause).toBeDefined())

    const resumesAt = Date.now() + 34_000
    act(() => announcePause!(resumesAt))

    expect(result.current.pausedUntil).toBe(resumesAt)
    expect(logText(result.current.logEntries)).toContain('pause de 34 secondes')
  })

  it('lets go of the pause once it is over', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(announcePause).toBeDefined())

    act(() => announcePause!(Date.now() + 34_000))
    act(() => announcePause!(null))

    expect(result.current.pausedUntil).toBeNull()
  })

  // Game names only serve to label a filter: their failure must not make a
  // successful search look like a failed one.
  /**
   * A slice nobody could fetch used to end the whole search: the error left
   * `collectClips`, the hook's `catch` ran instead of its success path, and
   * everything after `setClips` — the summary, the verdict, the game names —
   * was skipped along with the slices that had not been walked yet. The table
   * kept whatever the streaming had already put there, under a line saying the
   * search had failed and nothing saying what it had got.
   */
  it('finishes the search when a slice cannot be fetched at all', async () => {
    channelFound()
    gameNames(new Map())
    fetchPage.mockRejectedValue(new Error('helix said no'))

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(result.current.running).toBe(false))

    const log = logText(result.current.logEntries)
    expect(log).toContain('requête impossible après six tentatives')
    // The success path ran: the verdict is there, and so is the summary.
    expect(result.current.incomplete).toHaveLength(1)
    expect(log).toContain('0 clip unique')
    // The wording `log.failed` renders — which is what ran before, instead of
    // everything asserted above it.
    expect(log).not.toContain('Échec :')
  })

  it('keeps the clips even when the game names fail', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    gameNames(new Map(), true)

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(1))
    expect(logText(result.current.logEntries)).toContain('n’ont pas pu être obtenus')
  })

  // The names that did come back are worth keeping and worth showing; the
  // warning is there to say the list is not the whole of what was asked for.
  it('keeps the names it did get, and says so when some are missing', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    gameNames(new Map([['1', 'Cult of the Lamb']]), true)

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(1))
    expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb')
    expect(logText(result.current.logEntries)).toContain('n’ont pas pu être obtenus')
  })

  // An id Helix has no row for leaves a gap in the map on a request that went
  // perfectly well. Warning on it would cry wolf on every search touching a
  // category Twitch has retired.
  it('stays silent when every batch answered, gaps in the map included', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a', '305984745')] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(1))
    expect(logText(result.current.logEntries)).not.toContain('n’ont pas pu être obtenus')
  })

  // The cache is fed only by a search actually started, never by a plain
  // resolution of what is being typed.
  it('remembers the searched channel with its creation date', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(remember).toHaveBeenCalledWith('testchannel', '2017-07-10'))
  })

  it('remembers nothing when the channel cannot be found', async () => {
    fetchUser.mockRejectedValue(new Error('Channel not found'))

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    expect(remember).not.toHaveBeenCalled()
  })

  it('reports a refused token to the caller', async () => {
    const onTokenRejected = vi.fn()
    fetchUser.mockRejectedValue(new TokenRejectedError())

    const { result } = renderHook(() => useClipSearch(session, onTokenRejected))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(onTokenRejected).toHaveBeenCalled())
  })

  /**
   * The estimate of the time left is a rate: the slices behind the search, over
   * the time they took. Now that a page reports as it lands, the numerator moves
   * between two slices — so the clock must not. Sampled on every page instead,
   * the estimate would climb all the way through a window and snap back at its
   * boundary, which is a worse reading than none.
   */
  it('reads the clock at slice boundaries, not at every page', async () => {
    channelFound()
    gameNames(new Map())
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    // The second page is held open, which is the only moment the two clocks can
    // be told apart: a window's last page and the window itself report back to
    // back, at the same instant.
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    // The narrow second pass answers nothing and costs no time: what is under
    // test is the clock of the pass that walks the window, not the repair.
    let wide = 0
    fetchPage.mockImplementation(async (_w: unknown, _c: unknown, first: number) => {
      if (first !== 20) return { clips: [] }
      wide += 1
      now += 1_000
      if (wide === 1) return { clips: [clip('a')], cursor: 'p2' }
      await held
      return { clips: [clip('b')] }
    })

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    let search!: Promise<void>
    await act(async () => {
      search = result.current.start(request)
    })

    // A page has landed and two seconds have gone by on the clock…
    await waitFor(() => expect(result.current.progress?.requests).toBe(1))
    expect(now).toBe(2_000)
    // …the count has moved with it, which is the whole point of reporting pages…
    expect(result.current.progress?.clipsFound).toBe(1)
    // …and the rate has not, no slice having come back to move it.
    expect(result.current.elapsedMs).toBe(0)

    await act(async () => {
      release()
      await search
    })

    expect(result.current.progress?.windowsDone).toBe(1)
    expect(result.current.elapsedMs).toBe(2_000)
  })

  /**
   * The other half of the same rule, and the one the slice count cannot state.
   *
   * A saturated window is halved and run again: the slice count advances, and
   * the search has covered no ground whatsoever — its halves are about to walk
   * the very span it just walked. Keyed on the slice count, the clock is read
   * there, so the estimate divides a time that grew by a numerator that did
   * not, and lengthens at every split. That is the bar sliding backwards, in
   * words instead of pixels.
   */
  it('reads the clock when the period covered moves, not when a slice is split', async () => {
    channelFound()
    gameNames(new Map())
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    // A full page with a cursor still pending: the window saturates, gets
    // halved, and covers nothing.
    const saturating = Array.from({ length: 950 }, (_, i) => clip('c' + i))
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let wide = 0
    fetchPage.mockImplementation(async (_w: unknown, _c: unknown, first: number) => {
      if (first !== 20) return { clips: [] }
      wide += 1
      now += 1_000
      if (wide === 1) return { clips: saturating, cursor: 'more' }
      if (wide === 2) {
        await held
        return { clips: [clip('first-half')] }
      }
      return { clips: [clip('second-half')] }
    })

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    let search!: Promise<void>
    await act(async () => {
      search = result.current.start(request)
    })

    // The window is behind the search and its two halves are queued…
    await waitFor(() => expect(result.current.progress?.windowsTotal).toBe(3))
    expect(result.current.progress?.windowsDone).toBe(1)
    expect(result.current.progress?.coveredMs).toBe(0)
    expect(now).toBe(2_000)
    // …and the clock has not been read, there being no new ground to divide by.
    expect(result.current.elapsedMs).toBe(0)

    await act(async () => {
      release()
      await search
    })

    expect(result.current.elapsedMs).toBe(3_000)
  })

  it('starts from a clean slate on every search', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(result.current.clips).toHaveLength(1))

    fetchPage.mockResolvedValue({ clips: [clip('z')] })
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips.map((c) => c.id)).toEqual(['z']))
  })
})
