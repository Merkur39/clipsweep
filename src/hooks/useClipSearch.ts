import { useCallback, useRef, useState } from 'react'

import { channelCache } from '../domain/channelCache'
import { makeLogAppender, type LogEntry, type LogKind } from '../domain/log'
import type { T } from '../i18n/translate'
import { TokenRejectedError, TwitchApi } from '../twitch/api'
import type { Session } from '../twitch/auth'
import { describeError } from '../twitch/errors'
import { collectClips, type WindowReport } from '../twitch/clips'
import type { Clip, Progress } from '../twitch/types'
import { splitByYear } from '../twitch/windows'

const LOG_LIMIT = 500

export interface SearchRequest {
  channel: string
  /** `yyyy-mm-dd`, as the date inputs produce them. */
  since: string
  until: string
}

export interface Span {
  from: number
  to: number
}

export interface ClipSearch {
  clips: Clip[]
  reports: WindowReport[]
  /** Windows still saturated at the floor: their surplus clips are missing. */
  incomplete: WindowReport[]
  progress: Progress | null
  span: Span | null
  logEntries: LogEntry[]
  gameNames: ReadonlyMap<string, string>
  running: boolean
  start: (request: SearchRequest) => Promise<void>
  stop: () => void
}

/**
 * Drives one search: window seeding, collection, and the running commentary the
 * user reads while it happens. Everything it owns is reset on each start, so a
 * second search never shows remnants of the first.
 */
export function useClipSearch(
  session: Session | null,
  onTokenRejected: () => void,
  t: T,
): ClipSearch {
  const [clips, setClips] = useState<Clip[]>([])
  const [reports, setReports] = useState<WindowReport[]>([])
  const [incomplete, setIncomplete] = useState<WindowReport[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [span, setSpan] = useState<Span | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [gameNames, setGameNames] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [running, setRunning] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const appendRef = useRef(makeLogAppender(LOG_LIMIT))

  const log = useCallback((text: string, kind?: LogKind) => {
    setLogEntries(appendRef.current(text, kind))
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    log(t('log.stopRequested'), 'warn')
  }, [log, t])

  const start = useCallback(
    async ({ channel, since, until }: SearchRequest) => {
      if (!session) return

      const from = new Date(`${since}T00:00:00Z`)
      const to = new Date(`${until}T23:59:59Z`)
      // The interface already forbids this case; the guard stays, the hook being
      // callable without it.
      if (!(from < to)) {
        log(t('period.order'), 'err')
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      setRunning(true)
      setClips([])
      setReports([])
      setIncomplete([])
      setProgress(null)
      setLogEntries([])
      setGameNames(new Map())
      setSpan({ from: from.getTime(), to: to.getTime() })

      try {
        const api = new TwitchApi(session, controller.signal)
        const user = await api.fetchUser(channel)
        // Remembered only here: a channel actually swept earns its place in the
        // cache, a prefix crossed while typing does not.
        channelCache.remember(user.login, user.created_at.slice(0, 10))
        log(
          t('log.channel', {
            name: user.display_name,
            id: user.id,
            date: { day: user.created_at },
          }),
          'good',
        )
        if (Date.parse(user.created_at) < from.getTime()) {
          log(t('log.beforeCreation', { date: { day: since } }), 'warn')
        }

        // Yearly seeding; the bisection tightens where clips are dense.
        const windows = splitByYear(from, to)
        log(t('log.windows', { n: windows.length }))

        const result = await collectClips({
          windows,
          fetchPage: api.clipPageFetcher(user.id),
          signal: controller.signal,
          onProgress: setProgress,
          // The table fills in during the sweep instead of waiting for the end.
          onClips: setClips,
          onWindow: (report) => {
            setReports((previous) => [...previous, report])
            const window = {
              indent: '  '.repeat(report.depth),
              from: { day: report.window.startedAt },
              to: { day: report.window.endedAt },
              n: report.clipCount,
            }
            if (report.split) {
              log(t('log.windowSplit', window), 'warn')
            } else if (report.saturated) {
              log(t('log.windowLost', window), 'err')
            } else if (report.clipCount) {
              log(t('log.window', window))
            }
          },
        })

        setClips(result.clips)
        setIncomplete(result.incomplete)
        log(t('log.summary', { clips: result.clips.length, requests: result.requests }), 'good')
        if (controller.signal.aborted) {
          log(t('log.interrupted'), 'warn')
        }

        // Helix only returns a game id. Labelling a filter is worth one request,
        // but failing at it must not invalidate a search that succeeded.
        try {
          setGameNames(await api.fetchGameNames(result.clips.map((clip) => clip.game_id)))
        } catch {
          log(t('log.gameNames'), 'warn')
        }
      } catch (cause) {
        const error = cause as Error
        if (error.name === 'AbortError') return
        log(t('log.failed', { reason: describeError(error, t) }), 'err')
        if (error instanceof TokenRejectedError) onTokenRejected()
      } finally {
        setRunning(false)
        abortRef.current = null
      }
    },
    [session, log, onTokenRejected, t],
  )

  return {
    clips,
    reports,
    incomplete,
    progress,
    span,
    logEntries,
    gameNames,
    running,
    start,
    stop,
  }
}
