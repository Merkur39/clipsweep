// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TokenRejectedError } from '../twitch/api'
import type { Session } from '../twitch/auth'
import type { Clip } from '../twitch/types'
import { useClipSearch } from './useClipSearch'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

const fetchUser = vi.fn()
const fetchGameNames = vi.fn()
const fetchPage = vi.fn()

vi.mock('../twitch/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../twitch/api')>()),
  TwitchApi: class {
    fetchUser = (login: string) => fetchUser(login)
    fetchGameNames = (ids: string[]) => fetchGameNames(ids)
    clipPageFetcher = () => fetchPage
  },
}))

// jsdom n'expose pas de vrai Storage ici ; la logique du cache a ses tests.
const remember = vi.fn()
vi.mock('../domain/channelCache', () => ({
  channelCache: { read: () => null, remember: (...args: unknown[]) => remember(...args) },
}))

afterEach(cleanup)

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

const logText = (entries: { text: string }[]) => entries.map((e) => e.text).join('\n')

/** What the resolution of the game names hands back, whole unless said otherwise. */
const gameNames = (names: Map<string, string>, incomplete = false) =>
  fetchGameNames.mockResolvedValue({ names, incomplete })

describe('useClipSearch', () => {
  it('does not call the API without a session', async () => {
    const { result } = renderHook(() => useClipSearch(null, vi.fn(), t))

    await act(async () => result.current.start(request))

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('refuses an inverted date range, without a request', async () => {
    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))

    await act(async () => result.current.start({ ...request, since: '2026-02-01' }))

    expect(fetchUser).not.toHaveBeenCalled()
    expect(logText(result.current.logEntries)).toContain('date de début')
  })

  it('collects the clips and resolves the game names', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a'), clip('b')] })
    gameNames(new Map([['1', 'Cult of the Lamb']]))

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(2))
    expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb')
    expect(result.current.running).toBe(false)
  })

  it('warns when the channel predates the period asked for', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    expect(logText(result.current.logEntries)).toContain('hors périmètre')
  })

  // Game names only serve to label a filter: their failure must not make a
  // successful sweep look like a failed one.
  it('keeps the clips even when the game names fail', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    gameNames(new Map(), true)

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(1))
    expect(logText(result.current.logEntries)).toContain('n’ont pas pu être récupérés')
  })

  // The names that did come back are worth keeping and worth showing; the
  // warning is there to say the list is not the whole of what was asked for.
  it('keeps the names it did get, and says so when some are missing', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    gameNames(new Map([['1', 'Cult of the Lamb']]), true)

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(1))
    expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb')
    expect(logText(result.current.logEntries)).toContain('n’ont pas pu être récupérés')
  })

  // An id Helix has no row for leaves a gap in the map on a request that went
  // perfectly well. Warning on it would cry wolf on every sweep touching a
  // category Twitch has retired.
  it('stays silent when every batch answered, gaps in the map included', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a', '305984745')] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(1))
    expect(logText(result.current.logEntries)).not.toContain('n’ont pas pu être récupérés')
  })

  // The cache is fed only by a sweep actually started, never by a plain
  // resolution of what is being typed.
  it('remembers the swept channel with its creation date', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(remember).toHaveBeenCalledWith('testchannel', '2017-07-10'))
  })

  it('remembers nothing when the channel cannot be found', async () => {
    fetchUser.mockRejectedValue(new Error('Channel not found'))

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    expect(remember).not.toHaveBeenCalled()
  })

  it('reports a refused token to the caller', async () => {
    const onTokenRejected = vi.fn()
    fetchUser.mockRejectedValue(new TokenRejectedError())

    const { result } = renderHook(() => useClipSearch(session, onTokenRejected, t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(onTokenRejected).toHaveBeenCalled())
  })

  it('starts from a clean slate on every sweep', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    gameNames(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(result.current.clips).toHaveLength(1))

    fetchPage.mockResolvedValue({ clips: [clip('z')] })
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips.map((c) => c.id)).toEqual(['z']))
  })
})
