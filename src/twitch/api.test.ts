import { afterEach, describe, expect, it, vi } from 'vitest'

import { TwitchApi } from './api'
import type { Session } from './auth'

const session: Session = { clientId: 'c', accessToken: 't', expiresInSeconds: 3600 }

const ok = (data: unknown[]) =>
  ({ ok: true, status: 200, json: () => Promise.resolve({ data }) }) as Response

/** A 400 carries a message and is not retried, unlike a 5xx. */
const refused = (message: string) =>
  ({ ok: false, status: 400, json: () => Promise.resolve({ message }) }) as Response

const ids = (count: number, from = 0) =>
  Array.from({ length: count }, (_, index) => String(from + index))

const idsOf = (call: number) => {
  const url = new URL(vi.mocked(fetch).mock.calls[call][0] as string)
  return url.searchParams.getAll('id')
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchGameNames', () => {
  it('asks for a hundred ids at a time, the ceiling the endpoint sets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])))

    await new TwitchApi(session).fetchGameNames(ids(150))

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(idsOf(0)).toHaveLength(100)
    expect(idsOf(1)).toHaveLength(50)
  })

  it('resolves the ids it was given to their names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([{ id: '1', name: 'Cult of the Lamb' }])))

    const { names, incomplete } = await new TwitchApi(session).fetchGameNames(['1'])

    expect(names.get('1')).toBe('Cult of the Lamb')
    expect(incomplete).toBe(false)
  })

  // The point of the whole exercise: a request that fails costs its own hundred
  // and nothing more.
  it('keeps the names of the batches that answered when one of them fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(ok([{ id: '1', name: 'Cult of the Lamb' }]))
        .mockResolvedValueOnce(refused('Bad Request')),
    )

    const { names, incomplete } = await new TwitchApi(session).fetchGameNames(ids(150))

    expect(names.get('1')).toBe('Cult of the Lamb')
    expect(incomplete).toBe(true)
  })

  it('goes on to the batches that follow the one that failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(refused('Bad Request'))
        .mockResolvedValueOnce(ok([{ id: '150', name: 'Hollow Knight' }])),
    )

    const { names } = await new TwitchApi(session).fetchGameNames(ids(150))

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(names.get('150')).toBe('Hollow Knight')
  })

  // An id Helix has no row for comes back missing, exactly like one lost to a
  // failed request — but nothing went wrong, and saying so would cry wolf on
  // every sweep touching a retired category.
  it('leaves an id it does not know unnamed, without calling that a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])))

    const { names, incomplete } = await new TwitchApi(session).fetchGameNames(['305984745'])

    expect(names.size).toBe(0)
    expect(incomplete).toBe(false)
  })

  it('lets an abort through rather than folding it into a partial answer', async () => {
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted))

    await expect(new TwitchApi(session).fetchGameNames(['1'])).rejects.toThrow('aborted')
  })

  it('asks for nothing at all when there is no id to resolve', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const { names, incomplete } = await new TwitchApi(session).fetchGameNames(['', ''])

    expect(fetch).not.toHaveBeenCalled()
    expect(names.size).toBe(0)
    expect(incomplete).toBe(false)
  })
})
