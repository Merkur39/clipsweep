// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '../twitch/auth'
import type { TwitchUser } from '../twitch/types'
import { useChannelLookup } from './useChannelLookup'

const fetchUser = vi.fn()
vi.mock('../twitch/api', () => ({
  TwitchApi: class {
    fetchUser(login: string) {
      return fetchUser(login)
    }
  },
}))

// jsdom n'expose pas de vrai Storage dans ce montage : on simule le module de
// cache plutôt que le global. Sa logique a ses propres tests.
const cacheRead = vi.fn<(login: string) => string | null>()
vi.mock('../domain/channelCache', () => ({
  channelCache: {
    read: (login: string) => cacheRead(login),
    remember: vi.fn(),
  },
}))

const session: Session = { clientId: 'c', accessToken: 't', expiresInSeconds: 3600 }
const user = (login: string, createdAt: string) =>
  ({
    id: '1',
    login,
    display_name: login,
    profile_image_url: '',
    created_at: createdAt,
  }) as TwitchUser

beforeEach(() => {
  vi.useFakeTimers()
  cacheRead.mockReturnValue(null)
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/** Laisse expirer la temporisation puis vider la file de promesses. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(600)
  })
}

describe('useChannelLookup', () => {
  it('ne consulte pas l’API sans session', async () => {
    renderHook(() => useChannelLookup(null, 'testchannel'))

    await settle()

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('ne consulte pas l’API sur une saisie vide', async () => {
    renderHook(() => useChannelLookup(session, '   '))

    await settle()

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('rend la date de création de la chaîne résolue', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))
    expect(result.current).toBeNull()

    await settle()

    expect(result.current).toBe('2017-07-10')
  })

  it('normalise la casse de la saisie', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, '  TestChannel '))
    await settle()

    expect(result.current).toBe('2017-07-10')
  })

  // Sans temporisation, « k », « ka », « kal »… interrogeraient l'API chacun
  // pour un préfixe qui n'existe pas.
  it('ne lance qu’une requête pour une frappe continue', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { rerender } = renderHook(({ nom }) => useChannelLookup(session, nom), {
      initialProps: { nom: 'k' },
    })
    for (const nom of ['ka', 'kal', 'testchannel']) {
      rerender({ nom })
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
    }
    await settle()

    expect(fetchUser).toHaveBeenCalledTimes(1)
    expect(fetchUser).toHaveBeenCalledWith('testchannel')
  })

  it('n’affiche pas la date d’une chaîne qu’on ne demande plus', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))
    const { result, rerender } = renderHook(({ nom }) => useChannelLookup(session, nom), {
      initialProps: { nom: 'testchannel' },
    })
    await settle()
    expect(result.current).toBe('2017-07-10')

    // La réponse en vol décrit « testchannel », la saisie dit désormais autre chose.
    rerender({ nom: 'autrechaine' })

    expect(result.current).toBeNull()
  })

  // Une chaîne déjà fouillée a sa date en cache : la redemander à Helix à
  // chaque rechargement serait une requête pour rien.
  it('rend une date connue sans interroger l’API', async () => {
    cacheRead.mockReturnValue('2017-07-10')

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))

    expect(result.current).toBe('2017-07-10')
    await settle()
    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('interroge l’API pour une chaîne absente du cache', async () => {
    cacheRead.mockReturnValue(null)
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))
    await settle()

    expect(fetchUser).toHaveBeenCalledWith('testchannel')
    expect(result.current).toBe('2017-07-10')
  })

  it('reste silencieux sur une chaîne introuvable', async () => {
    fetchUser.mockRejectedValue(new Error('Chaîne introuvable'))

    const { result } = renderHook(() => useChannelLookup(session, 'nexistepas'))
    await settle()

    expect(result.current).toBeNull()
  })
})
