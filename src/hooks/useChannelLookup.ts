import { useEffect, useState } from 'react'

import { TwitchApi } from '../twitch/api'
import type { Session } from '../twitch/auth'

const DEBOUNCE_MS = 500

/**
 * Resolves the channel as it is typed, so its creation date can be offered
 * before the first search — which is precisely when the date is useful, since
 * that is when the interval gets chosen.
 *
 * The resolved login is kept alongside its date and compared against the current
 * input: a late response can then only describe the channel actually on screen,
 * never overwrite it with a stale one.
 */
export function useChannelLookup(session: Session | null, channel: string): string | null {
  const [resolved, setResolved] = useState<{ login: string; createdAt: string } | null>(null)
  const wanted = channel.trim().toLowerCase()

  useEffect(() => {
    if (!session || !wanted) return

    const controller = new AbortController()
    // Without the delay every keystroke would query the API for a prefix that
    // does not exist.
    const timer = setTimeout(() => {
      new TwitchApi(session, controller.signal)
        .fetchUser(wanted)
        .then((user) => setResolved({ login: user.login, createdAt: user.created_at.slice(0, 10) }))
        // Unknown channel, or input abandoned: the caller simply gets null.
        .catch(() => {})
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [session, wanted])

  return resolved?.login === wanted ? resolved.createdAt : null
}
