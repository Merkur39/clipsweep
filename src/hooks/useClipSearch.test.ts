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

const texteJournal = (entries: { text: string }[]) => entries.map((e) => e.text).join('\n')

describe('useClipSearch', () => {
  it('n’appelle pas l’API sans session', async () => {
    const { result } = renderHook(() => useClipSearch(null, vi.fn(), t))

    await act(async () => result.current.start(request))

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('refuse un intervalle de dates inversé, sans requête', async () => {
    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))

    await act(async () => result.current.start({ ...request, since: '2026-02-01' }))

    expect(fetchUser).not.toHaveBeenCalled()
    expect(texteJournal(result.current.logEntries)).toContain('date de début')
  })

  it('collecte les clips et résout les noms de jeux', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a'), clip('b')] })
    fetchGameNames.mockResolvedValue(new Map([['1', 'Cult of the Lamb']]))

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(2))
    expect(result.current.gameNames.get('1')).toBe('Cult of the Lamb')
    expect(result.current.running).toBe(false)
  })

  it('prévient quand la chaîne est antérieure à la période demandée', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    fetchGameNames.mockResolvedValue(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    expect(texteJournal(result.current.logEntries)).toContain('hors périmètre')
  })

  // Les noms de jeux ne servent qu'à étiqueter un filtre : leur échec ne doit
  // pas faire passer un scan réussi pour un échec.
  it('conserve les clips même si les noms de jeux échouent', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    fetchGameNames.mockRejectedValue(new Error('boum'))

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips).toHaveLength(1))
    expect(texteJournal(result.current.logEntries)).toContain('Noms des jeux indisponibles')
  })

  // Le cache n'est alimenté que par un scan réellement lancé, jamais par
  // une simple résolution de saisie.
  it('retient la chaîne scannée avec sa date de création', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [] })
    fetchGameNames.mockResolvedValue(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(remember).toHaveBeenCalledWith('testchannel', '2017-07-10'))
  })

  it('ne retient rien quand la chaîne est introuvable', async () => {
    fetchUser.mockRejectedValue(new Error('Chaîne introuvable'))

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.running).toBe(false))
    expect(remember).not.toHaveBeenCalled()
  })

  it('signale un jeton refusé à l’appelant', async () => {
    const onTokenRejected = vi.fn()
    fetchUser.mockRejectedValue(new TokenRejectedError())

    const { result } = renderHook(() => useClipSearch(session, onTokenRejected, t))
    await act(async () => result.current.start(request))

    await waitFor(() => expect(onTokenRejected).toHaveBeenCalled())
  })

  it('repart d’une ardoise vierge à chaque scan', async () => {
    channelFound()
    fetchPage.mockResolvedValue({ clips: [clip('a')] })
    fetchGameNames.mockResolvedValue(new Map())

    const { result } = renderHook(() => useClipSearch(session, vi.fn(), t))
    await act(async () => result.current.start(request))
    await waitFor(() => expect(result.current.clips).toHaveLength(1))

    fetchPage.mockResolvedValue({ clips: [clip('z')] })
    await act(async () => result.current.start(request))

    await waitFor(() => expect(result.current.clips.map((c) => c.id)).toEqual(['z']))
  })
})
