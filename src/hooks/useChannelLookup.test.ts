// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '../twitch/auth'
import { TranslatableError } from '../twitch/errors'
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
const user = (login: string, createdAt: string): TwitchUser => ({
  id: '1',
  login,
  display_name: login,
  profile_image_url: '',
  created_at: createdAt,
})

beforeEach(() => {
  vi.useFakeTimers()
  cacheRead.mockReturnValue(null)
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/** Lets the debounce run out, then drains the promise queue. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(600)
  })
}

/**
 * What is known about the name being typed — and `null` used to say four
 * different things at once: nothing typed, waiting on Twitch, no such channel,
 * and the lookup itself failed. Only one of the four is grounds for refusing to
 * search, so they have to be told apart.
 */
describe('useChannelLookup', () => {
  it('has nothing to say about an empty field', async () => {
    renderHook(() => useChannelLookup(session, '   '))

    await settle()

    expect(fetchUser).not.toHaveBeenCalled()
  })

  /* Not "missing": nothing was learned, and the difference matters — a channel
     is only refused on Twitch's own answer. */
  it('learns nothing without a session, and does not ask', async () => {
    const { result } = renderHook(() => useChannelLookup(null, 'testchannel'))

    await settle()

    expect(fetchUser).not.toHaveBeenCalled()
    expect(result.current).toEqual({ status: 'unreachable' })
  })

  it('is checking until the answer comes back', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))
    expect(result.current).toEqual({ status: 'checking' })

    await settle()

    expect(result.current).toEqual({ status: 'found', createdAt: '2017-07-10' })
  })

  it('normalizes the case of the input', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, '  TestChannel '))
    await settle()

    expect(result.current).toEqual({ status: 'found', createdAt: '2017-07-10' })
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

  it('does not describe a channel no longer asked for', async () => {
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))
    const { result, rerender } = renderHook(({ name }) => useChannelLookup(session, name), {
      initialProps: { name: 'testchannel' },
    })
    await settle()
    expect(result.current).toEqual({ status: 'found', createdAt: '2017-07-10' })

    // The answer in hand describes "testchannel", the input now says otherwise.
    rerender({ name: 'otherchannel' })

    expect(result.current).toEqual({ status: 'checking' })
  })

  // A channel already searched has its date in cache: asking Helix again on every
  // reload would be a request for nothing.
  it('answers from the cache without querying the API', async () => {
    cacheRead.mockReturnValue('2017-07-10')

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))

    expect(result.current).toEqual({ status: 'found', createdAt: '2017-07-10' })
    await settle()
    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('queries the API for a channel missing from the cache', async () => {
    cacheRead.mockReturnValue(null)
    fetchUser.mockResolvedValue(user('testchannel', '2017-07-10T00:00:00Z'))

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))
    await settle()

    expect(fetchUser).toHaveBeenCalledWith('testchannel')
    expect(result.current).toEqual({ status: 'found', createdAt: '2017-07-10' })
  })

  /* The one answer that disproves a channel, and it has to come from Twitch
     saying so — hence the key rather than the shape of the failure. */
  it('reports a channel Twitch says does not exist', async () => {
    fetchUser.mockRejectedValue(new TranslatableError('error.channelNotFound', { login: 'nope' }))

    const { result } = renderHook(() => useChannelLookup(session, 'nope'))
    await settle()

    expect(result.current).toEqual({ status: 'missing' })
  })

  /**
   * A lookup that fell over proves nothing about the channel. Reading it as
   * "does not exist" would refuse a search over a dropped connection, on a name
   * that may well be right.
   */
  it('keeps a failed lookup apart from a channel that is not there', async () => {
    fetchUser.mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useChannelLookup(session, 'testchannel'))
    await settle()

    expect(result.current).toEqual({ status: 'unreachable' })
  })
})
