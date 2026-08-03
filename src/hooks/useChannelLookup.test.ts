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

// jsdom exposes no real Storage in this setup: we mock the cache module
// rather than the global. Its own logic has its own tests.
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
  it('does not call the API without a session', async () => {
    renderHook(() => useChannelLookup(null, 'testchannel'))

    await settle()

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('does not call the API on empty input', async () => {
    renderHook(() => useChannelLookup(session, '   '))

    await settle()

    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('returns the creation date of the resolved channel', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))
    expect(result.current).toBeNull()

    await settle()

    expect(result.current).toBe('2017-07-10')
  })

  it('normalizes the case of the input', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, '  TestChannel '))
    await settle()

    expect(result.current).toBe('2017-07-10')
  })

  // Without debouncing, "k", "ka", "kal"… would each query the API for a
  // prefix that does not exist.
  it('fires a single request for continuous typing', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { rerender } = renderHook(({ name }) => useChannelLookup(session, name), {
      initialProps: { name: 'k' },
    })
    for (const name of ['ka', 'kal', 'testchannel']) {
      rerender({ name })
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
    }
    await settle()

    expect(fetchUser).toHaveBeenCalledTimes(1)
    expect(fetchUser).toHaveBeenCalledWith('testchannel')
  })

  it('does not show the date of a channel no longer asked for', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))
    const { result, rerender } = renderHook(({ name }) => useChannelLookup(session, name), {
      initialProps: { name: 'testchannel' },
    })
    await settle()
    expect(result.current).toBe('2017-07-10')

    // The in-flight response describes "testchannel", the input now says otherwise.
    rerender({ name: 'otherchannel' })

    expect(result.current).toBeNull()
  })

  // A channel already swept has its date in cache: asking Helix again on every
  // reload would be a request for nothing.
  it('returns a known date without querying the API', async () => {
    cacheRead.mockReturnValue('2017-07-10')

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))

    expect(result.current).toBe('2017-07-10')
    await settle()
    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('queries the API for a channel missing from the cache', async () => {
    cacheRead.mockReturnValue(null)
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))
    await settle()

    expect(fetchUser).toHaveBeenCalledWith('testchannel')
    expect(result.current).toBe('2017-07-10')
  })

  it('stays silent on a channel that cannot be found', async () => {
    fetchUser.mockRejectedValue(new Error('Channel not found'))

    const { result } = renderHook(() => useChannelLookup(session, 'nexistepas'))
    await settle()

    expect(result.current).toBeNull()
  })
})
