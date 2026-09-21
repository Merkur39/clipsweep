import type { Session } from './auth'
import type { ClipPageFetcher } from './clips'
import { TranslatableError } from './errors'
import type { Clip, Game, TwitchUser } from './types'

const HELIX = 'https://api.twitch.tv/helix'
/**
 * How far apart two requests are held, in milliseconds.
 *
 * Helix allows 800 points a minute per user and per client ID, and a request
 * costs one point: the quota itself says 75 ms. The figure here used to be 60,
 * under a comment quoting that same 800 — which is 1000 requests a minute, a
 * quarter over the allowance. It never showed, because nothing paced the sweep
 * but Twitch's own latency: measured on 2026-09-21 over 915 requests, 357 ms a
 * request and 2,36 a second, a fifth of what the spacing permitted.
 *
 * So 85 rather than 75: a quota is what must not be crossed, not what to aim
 * at, and two things spend from the same bucket that this gate never sees
 * coming — `useChannelLookup`, which fires while the user types, and a second
 * tab on the same token. 85 ms is 706 a minute, and leaves them the room.
 */
export const THROTTLE_MS = 85
const MAX_ATTEMPTS = 6

/**
 * A wait a stop cuts short, by travelling out as the abort it is.
 *
 * Every wait in this client holds nothing: a 429 and a server error have given
 * us no page, and the spacing is taken before the request rather than after the
 * response. There used to be a second mode for that last one, which resolved
 * instead of rejecting so a stop could not throw away a page already fetched
 * and paid for. Moving the spacing ahead of the request retired the case, not
 * the rule — see [createSpacingGate].
 *
 * Written on `setTimeout` and an `abort` listener rather than on
 * `AbortSignal.any`: the signal is optional here, and `any` escapes the fake
 * clocks the pause is tested with.
 */
function sleep(ms: number, signal: AbortSignal | undefined) {
  return new Promise<void>((resolve, reject) => {
    const stopped = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal?.aborted) return stopped()

    const cut = () => {
      clearTimeout(timer)
      stopped()
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cut)
      resolve()
    }, ms)
    signal?.addEventListener('abort', cut, { once: true })
  })
}

/** Holds a caller back until the slot it reserved comes round. */
export type SpacingGate = (signal?: AbortSignal) => Promise<void>

/**
 * A gate handing out one slot every `intervalMs`, in the order they are asked
 * for.
 *
 * The slot is reserved synchronously, before the first await: two callers
 * arriving in the same tick take two different slots rather than the same one,
 * which is the whole reason this is a gate and not a sleep. What is in flight
 * is therefore bounded by the gate alone — whatever the latency of the service,
 * and however many requests a caller runs at once.
 *
 * Taken BEFORE the request, it costs a lone request nothing, where the wait it
 * replaces made a search of one request pay a spacing that spaced it from
 * nothing. And it binds only once requests would otherwise overlap, which is
 * precisely when a quota needs defending.
 */
export function createSpacingGate(intervalMs: number): SpacingGate {
  let nextAt = 0

  return async (signal) => {
    const now = Date.now()
    const at = Math.max(now, nextAt)
    nextAt = at + intervalMs
    if (at > now) await sleep(at - now, signal)
  }
}

/**
 * The one gate every client shares, a quota being counted per user and per
 * client ID rather than per object: `useChannelLookup` builds a client of its
 * own and fires it on every keystroke, sweep or no sweep.
 */
let shared = createSpacingGate(THROTTLE_MS)
export const sharedSpacing: SpacingGate = (signal) => shared(signal)
/** State shared between clients is state shared between tests. */
export function resetSharedSpacing(): void {
  shared = createSpacingGate(THROTTLE_MS)
}

/** Raised on 401 so the UI can drop the session and offer to reconnect. */
export class TokenRejectedError extends TranslatableError {
  constructor() {
    super('error.tokenRejected')
    this.name = 'TokenRejectedError'
  }
}

/**
 * Told the moment Helix asks for a pause, with the epoch millisecond the client
 * means to resume at, and told again with null once it has.
 *
 * The client waits either way; what this buys is that the wait can be said. Up
 * to a minute of a search standing still, in silence, is indistinguishable from
 * a search that has hung — and the reader's only move then is to give up on one
 * that was going to finish.
 */
export type PauseListener = (resumesAt: number | null, reason?: PauseReason) => void

/**
 * Why the client is standing still. Twitch asking for the points back is not
 * the same news as Twitch not answering, and the log says neither if it is
 * handed one word for both.
 */
export type PauseReason = 'rate-limit' | 'server'

interface HelixResponse<T> {
  data: T[]
  pagination?: { cursor?: string }
  message?: string
}

export class TwitchApi {
  constructor(
    private readonly session: Session,
    private readonly signal?: AbortSignal,
    private readonly onPause?: PauseListener,
    /** Injectable so a test gets a gate of its own; shared everywhere else. */
    private readonly spacing: SpacingGate = sharedSpacing,
  ) {}

  private async get<T>(
    path: string,
    // Repeated keys — `id` on /games — need URLSearchParams, not a record.
    params: URLSearchParams | Record<string, string>,
  ): Promise<HelixResponse<T>> {
    const query = params instanceof URLSearchParams ? params : new URLSearchParams(params)
    const url = `${HELIX}/${path}?${query}`

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // Before the request, so a retry queues behind whatever else is in flight
      // rather than jumping it: the point the last attempt burned is gone, and
      // the bucket does not care that this one is a second try.
      await this.spacing(this.signal)
      const response = await fetch(url, {
        signal: this.signal,
        headers: {
          'Client-Id': this.session.clientId,
          Authorization: `Bearer ${this.session.accessToken}`,
        },
      })

      if (response.status === 429) {
        // Helix answers with the epoch second at which the bucket refills.
        const reset = Number(response.headers.get('ratelimit-reset')) * 1000
        const waitMs = Number.isFinite(reset) && reset > Date.now() ? reset - Date.now() : 5000
        // Capped whatever the header says: a reset an hour out is a header to
        // distrust, not an hour to sit through.
        const wait = Math.min(waitMs + 250, 60_000)
        this.onPause?.(Date.now() + wait, 'rate-limit')
        await sleep(wait, this.signal)
        this.onPause?.(null)
        continue
      }
      if (response.status === 401) throw new TokenRejectedError()
      if (response.status >= 500) {
        // Announced like the 429 above, and for the same reason: the last of
        // these backs off for thirty-two seconds, and a bar that stops moving
        // for half a minute with nothing said is the very picture of a hang.
        const backoff = 1000 * 2 ** attempt
        this.onPause?.(Date.now() + backoff, 'server')
        await sleep(backoff, this.signal)
        this.onPause?.(null)
        continue
      }

      const payload = (await response.json()) as HelixResponse<T>
      // Twitch's `message` is free text, in English: we take it as-is rather
      // than trying to recognize it.
      if (!response.ok) {
        throw payload.message
          ? new Error(payload.message)
          : new TranslatableError('error.helixStatus', { status: String(response.status) })
      }

      return payload
    }

    throw new TranslatableError('error.attemptsExhausted', { n: MAX_ATTEMPTS, path })
  }

  async fetchUser(login: string): Promise<TwitchUser> {
    const { data } = await this.get<TwitchUser>('users', { login: login.trim().toLowerCase() })
    const user = data[0]
    if (!user) throw new TranslatableError('error.channelNotFound', { login })
    return user
  }

  /**
   * Resolves game ids to names, 100 at a time — the endpoint's ceiling.
   *
   * A batch that fails costs its own hundred and nothing more. These names only
   * label a filter: dropping the four hundred already in hand because the fifth
   * request timed out trades a whole legible filter for a partly legible one.
   *
   * `incomplete` reports that some batch was lost, which is not the same thing
   * as a name missing from the map. Helix returns no row for a category it has
   * retired, and that id comes back unnamed on a request that went perfectly
   * well — reading the map's gaps as failures would cry wolf on every search
   * touching an old clip.
   */
  async fetchGameNames(
    gameIds: string[],
  ): Promise<{ names: Map<string, string>; incomplete: boolean }> {
    const names = new Map<string, string>()
    const unique = [...new Set(gameIds.filter(Boolean))]
    let incomplete = false

    for (let offset = 0; offset < unique.length; offset += 100) {
      const params = new URLSearchParams()
      for (const id of unique.slice(offset, offset + 100)) params.append('id', id)

      try {
        const { data } = await this.get<Game>('games', params)
        for (const game of data) names.set(game.id, game.name)
      } catch (cause) {
        // An abort is the user stopping the search, not a batch going wrong:
        // swallowing it here would have us carry on requesting after the stop.
        if ((cause as Error).name === 'AbortError') throw cause
        incomplete = true
      }
    }
    return { names, incomplete }
  }

  /**
   * The page size is the caller's, not ours: it is the one knob that decides
   * how much Helix withholds — see `DEFAULT_RESCUE_PAGE_SIZE` — so it belongs
   * with the code that reads the gap and buys it back.
   */
  clipPageFetcher(broadcasterId: string): ClipPageFetcher {
    return async (window, cursor, first) => {
      const params: Record<string, string> = {
        broadcaster_id: broadcasterId,
        first: String(first),
        started_at: window.startedAt,
        ended_at: window.endedAt,
      }
      if (cursor) params.after = cursor

      const { data, pagination } = await this.get<Clip>('clips', params)
      return { clips: data, cursor: pagination?.cursor || undefined }
    }
  }
}
