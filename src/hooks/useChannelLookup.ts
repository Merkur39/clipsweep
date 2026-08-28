import { useEffect, useState } from 'react'

import { channelCache } from '../domain/channelCache'
import { TwitchApi } from '../twitch/api'
import type { Session } from '../twitch/auth'
import { TranslatableError } from '../twitch/errors'

const DEBOUNCE_MS = 500

/**
 * What is known about the name being typed.
 *
 * Four states and not a nullable date, because the caller now refuses to search
 * on one of them and must not refuse on the other three. `missing` is the only
 * one that disproves a channel, and it is only ever reached on Twitch answering
 * that there is no such user: a lookup that fell over lands on `unreachable`,
 * where a dropped connection cannot be read as a name that is wrong.
 */
export type ChannelLookup =
  | { status: 'blank' }
  | { status: 'checking' }
  | { status: 'found'; createdAt: string }
  | { status: 'missing' }
  | { status: 'unreachable' }

/** Twitch answering "no such user", as opposed to the request failing. */
const saysNoSuchChannel = (error: unknown) =>
  error instanceof TranslatableError && error.key === 'error.channelNotFound'

/**
 * Resolves the channel as it is typed, so its creation date can be offered
 * before the first search — which is precisely when the date is useful, since
 * that is when the interval gets chosen — and so a name that names nothing can
 * be said to name nothing before minutes are spent on it.
 *
 * The answer is kept alongside the login it describes and compared against the
 * current input: a late response can then only describe the channel actually on
 * screen, never overwrite it with a stale one.
 */
export function useChannelLookup(session: Session | null, channel: string): ChannelLookup {
  const [answer, setAnswer] = useState<{ login: string; result: ChannelLookup } | null>(null)
  const wanted = channel.trim().toLowerCase()

  // A channel already searched has its date on hand: asking Helix again on every
  // reload would be a request for something that cannot have changed.
  const cached = wanted ? channelCache.read(wanted) : null

  useEffect(() => {
    if (!session || !wanted || channelCache.read(wanted)) return

    const controller = new AbortController()
    // Without the delay every keystroke would query the API for a prefix that
    // does not exist.
    const timer = setTimeout(() => {
      new TwitchApi(session, controller.signal)
        .fetchUser(wanted)
        .then((user) =>
          setAnswer({
            login: user.login,
            result: { status: 'found', createdAt: user.created_at.slice(0, 10) },
          }),
        )
        .catch((error: unknown) => {
          // The abort is this effect being cleaned up, not an answer about the
          // channel: the input has moved on, and so has the state.
          if (controller.signal.aborted) return

          setAnswer({
            login: wanted,
            result: { status: saysNoSuchChannel(error) ? 'missing' : 'unreachable' },
          })
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [session, wanted])

  if (!wanted) return { status: 'blank' }
  if (cached) return { status: 'found', createdAt: cached }
  // Nothing can be asked, so nothing is known — which is not the same as
  // knowing the channel is not there.
  if (!session) return { status: 'unreachable' }

  return answer?.login === wanted ? answer.result : { status: 'checking' }
}
