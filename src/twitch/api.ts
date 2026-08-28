import type { Session } from './auth'
import type { ClipPageFetcher } from './clips'
import { TranslatableError } from './errors'
import type { Clip, Game, TwitchUser } from './types'

const HELIX = 'https://api.twitch.tv/helix'
const PAGE_SIZE = 100
/** Helix allows 800 points/min; one request costs one point. */
const THROTTLE_MS = 60
const MAX_ATTEMPTS = 6

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
export type PauseListener = (resumesAt: number | null) => void

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
  ) {}

  private async get<T>(
    path: string,
    // Repeated keys — `id` on /games — need URLSearchParams, not a record.
    params: URLSearchParams | Record<string, string>,
  ): Promise<HelixResponse<T>> {
    const query = params instanceof URLSearchParams ? params : new URLSearchParams(params)
    const url = `${HELIX}/${path}?${query}`

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
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
        this.onPause?.(Date.now() + wait)
        await sleep(wait)
        this.onPause?.(null)
        continue
      }
      if (response.status === 401) throw new TokenRejectedError()
      if (response.status >= 500) {
        await sleep(1000 * 2 ** attempt)
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

      await sleep(THROTTLE_MS)
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

  clipPageFetcher(broadcasterId: string): ClipPageFetcher {
    return async (window, cursor) => {
      const params: Record<string, string> = {
        broadcaster_id: broadcasterId,
        first: String(PAGE_SIZE),
        started_at: window.startedAt,
        ended_at: window.endedAt,
      }
      if (cursor) params.after = cursor

      const { data, pagination } = await this.get<Clip>('clips', params)
      return { clips: data, cursor: pagination?.cursor || undefined }
    }
  }
}
