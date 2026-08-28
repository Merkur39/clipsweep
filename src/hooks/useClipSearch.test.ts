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
  it('reads in the language it is read in, not the one it ran in', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn()))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    const read = (locale: 'fr' | 'en') =>
      result.current.logEntries.map((entry) => entry.say(makeT(locale))).join(' ')
    expect(read('fr')).toContain('tranche annuelle')
    expect(read('en')).toContain('yearly slice')
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
    fetchPage
      .mockImplementationOnce(async () => {
        now += 1_000
        return { clips: [clip('a')], cursor: 'p2' }
      })
      .mockImplementationOnce(async () => {
        now += 1_000
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
    fetchPage
      .mockImplementationOnce(async () => {
        now += 1_000
        return { clips: saturating, cursor: 'more' }
      })
      .mockImplementationOnce(async () => {
        now += 1_000
        await held
        return { clips: [clip('first-half')] }
      })
      .mockImplementation(async () => {
        now += 1_000
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
