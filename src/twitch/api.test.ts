import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetSharedSpacing, THROTTLE_MS, TwitchApi } from './api'
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

afterEach(() => {
  vi.unstubAllGlobals()
  // The gate is shared between clients on purpose, so it is shared between
  // tests too: left alone, a slot one test reserved holds the next one back —
  // and under fake timers, holds it back until a clock that no longer runs.
  resetSharedSpacing()
})

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
  // every search touching a retired category.
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

/**
 * Helix answers 429 when the minute's points run out, and the client waits it
 * out — for up to a minute. Waiting is right; waiting in silence is not: the
 * interface has to be told, or a search that stops moving reads as one that has
 * hung.
 */
describe('the pause Helix asks for', () => {
  const throttled = (resetEpochSeconds: number) =>
    ({
      ok: false,
      status: 429,
      headers: new Headers({ 'ratelimit-reset': String(resetEpochSeconds) }),
      json: () => Promise.resolve({}),
    }) as unknown as Response

  afterEach(() => vi.useRealTimers())

  const announce = async (resetIn: number) => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(throttled(Math.floor(now / 1000) + resetIn))
        .mockResolvedValue(ok([])),
    )
    const announced: (number | null)[] = []

    /* The rejection is swallowed here rather than after the timers, and the
       difference is the whole point: `fetchUser` settles *during*
       `advanceTimersByTimeAsync`, so a handler attached afterwards arrives too
       late and Node reports an unhandled rejection — which fails the run while
       every assertion still passes. */
    const pending = new TwitchApi(session, undefined, (until) => announced.push(until))
      .fetchUser('kaliyami')
      .catch(() => undefined)
    await vi.advanceTimersByTimeAsync(70_000)
    await pending

    return { announced, now }
  }

  it('says when it will resume, then says it has', async () => {
    const { announced, now } = await announce(30)

    expect(announced).toHaveLength(2)
    // The header carries whole seconds, so the moment announced lands within a
    // second of the reset it names — the margin the client adds included.
    expect(announced[0]).toBeGreaterThan(now + 29_000)
    expect(announced[0]).toBeLessThan(now + 31_000)
    expect(announced[1]).toBeNull()
  })

  // Whatever Helix says, the wait is capped at a minute: a reset that lands an
  // hour out is a header to distrust, not an hour to sit through.
  it('never announces more than the minute it is willing to wait', async () => {
    const { announced, now } = await announce(3600)

    expect(announced[0]).toBeLessThanOrEqual(now + 60_000)
  })

  it('retries once the pause is over', async () => {
    await announce(30)

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

/**
 * A stop has to reach the waits, and not only the requests. The client spends
 * more of a sweep waiting than fetching — sixty milliseconds between every
 * request, up to a minute on a 429, up to thirty-two seconds backing off a
 * server error — and a wait that ignores the signal keeps a stopped search
 * alive for as long as it lasts.
 */
describe('a stop reaching the waits', () => {
  afterEach(() => vi.useRealTimers())

  const throttled = () =>
    ({
      ok: false,
      status: 429,
      headers: new Headers({ 'ratelimit-reset': String(Math.floor(Date.now() / 1000) + 30) }),
      json: () => Promise.resolve({}),
    }) as unknown as Response

  it('cuts a pause short rather than sitting it out', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(throttled()))
    const controller = new AbortController()

    const pending = new TwitchApi(session, controller.signal).fetchUser('kaliyami')
    const settled = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(10)
    controller.abort()
    await vi.advanceTimersByTimeAsync(10)
    await settled

    // The minute was never spent, and the request was never tried again.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  /**
   * A page already fetched, parsed and paid for is never thrown away by a stop
   * that lands after it: dropping it would cost up to twenty clips the sweep
   * holds, for a point of quota already spent.
   *
   * This used to be a property of the spacing, which sat after the response and
   * had to resolve rather than reject on an abort. The spacing now runs ahead
   * of the request, so nothing at all waits behind a page — the rule holds
   * because there is no longer anywhere for it to break, which is worth a test
   * saying so rather than a mode in `sleep` nobody reaches.
   */
  it('hands back the page it already holds when a stop lands after it', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort()
        return ok([{ id: '1', login: 'kaliyami', display_name: 'KaliYami' }])
      }),
    )

    await expect(
      new TwitchApi(session, controller.signal).fetchUser('kaliyami'),
    ).resolves.toMatchObject({ login: 'kaliyami' })
  })

  /**
   * And a server error says so. The 429 branch has always announced its wait;
   * this one backed off in silence for up to thirty-two seconds — a bar that
   * stops moving, no countdown, no line in the log. Which is the very picture
   * of a hang the announcement exists to prevent.
   */
  it('announces the wait it takes after a server error', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        } as Response)
        .mockResolvedValue(ok([{ id: '1', login: 'kaliyami', display_name: 'KaliYami' }])),
    )
    const announced: { until: number | null; reason?: string }[] = []

    const pending = new TwitchApi(session, undefined, (until, reason) =>
      announced.push({ until, reason }),
    ).fetchUser('kaliyami')
    await vi.advanceTimersByTimeAsync(5_000)
    await pending

    expect(announced).toHaveLength(2)
    expect(announced[0].reason).toBe('server')
    expect(announced[1].until).toBeNull()
  })
})

/**
 * The spacing between requests, taken BEFORE the request rather than after the
 * response, and shared by every client rather than kept per instance.
 *
 * Both halves of that were measured on 2026-09-21, `kaliyami`, 915 requests: a
 * request takes 357 ms and the spacing added 64 ms on top of every one of them,
 * for a cycle of 421 ms and a throughput of 2,36 req/s. Taken beforehand the
 * spacing never binds at that latency — it only binds when requests start
 * overlapping, which is exactly when a quota needs defending. And it has to be
 * shared, because a per-instance gate bounds nothing: `useChannelLookup` builds
 * a client of its own and fires it while the user types, sweep or no sweep.
 */
describe('the spacing between requests', () => {
  afterEach(() => vi.useRealTimers())

  const user = [{ id: '1', login: 'kaliyami', display_name: 'KaliYami' }]

  // The wait used to sit after the response, so a search of one request paid a
  // spacing that spaced it from nothing.
  it('does not make a lone request pay the spacing', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(user)))

    const pending = new TwitchApi(session).fetchUser('kaliyami')
    await vi.advanceTimersByTimeAsync(0)

    await expect(pending).resolves.toMatchObject({ login: 'kaliyami' })
  })

  it('holds the next request back, across clients that share nothing else', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(user)))

    const first = new TwitchApi(session).fetchUser('kaliyami')
    const second = new TwitchApi(session).fetchUser('kaliyami')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(THROTTLE_MS)
    expect(fetch).toHaveBeenCalledTimes(2)
    await Promise.all([first, second])
  })

  /**
   * A stop landing on this wait holds nothing — the request has not gone out —
   * so it travels out as the abort it is, and no point of quota is spent. That
   * is the opposite of the wait it replaces, which sat on a page already paid
   * for and had to resolve rather than reject.
   */
  it('lets a stop out, and never makes the request', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(user)))
    const controller = new AbortController()

    const first = new TwitchApi(session).fetchUser('kaliyami')
    await vi.advanceTimersByTimeAsync(0)
    const second = new TwitchApi(session, controller.signal).fetchUser('kaliyami')
    const settled = expect(second).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await vi.advanceTimersByTimeAsync(THROTTLE_MS)

    await settled
    expect(fetch).toHaveBeenCalledTimes(1)
    await first
  })
})
