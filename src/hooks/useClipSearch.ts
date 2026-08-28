import { useCallback, useRef, useState } from 'react'

import { channelCache } from '../domain/channelCache'
import { makeLogAppender, type LogEntry, type LogKind } from '../domain/log'
import type { Params } from '../i18n/message'
import type { MessageKey } from '../i18n/messages.fr'
import { TokenRejectedError, TwitchApi } from '../twitch/api'
import type { Session } from '../twitch/auth'
import { describeError } from '../twitch/errors'
import { collectClips, type WindowReport } from '../twitch/clips'
import type { Clip, Progress } from '../twitch/types'
import { splitByYear, type Span } from '../twitch/windows'

const LOG_LIMIT = 500

export interface SearchRequest {
  channel: string
  /** `yyyy-mm-dd`, as the date inputs produce them. */
  since: string
  until: string
}

export interface ClipSearch {
  clips: Clip[]
  reports: WindowReport[]
  /** Windows still saturated at the floor: their surplus clips are missing. */
  incomplete: WindowReport[]
  progress: Progress | null
  /**
   * How long the running search has been going, sampled at the moment the
   * period behind it last moved.
   *
   * It travels with `progress` rather than being read off the clock where it is
   * displayed, so the two can never disagree: an estimate of the time left is a
   * rate, and a rate whose numerator and denominator were taken at different
   * moments is not one.
   *
   * At the moment the *ground* moved, and not at every report: a page landing
   * leaves the search inside the same slice, and a slice being halved covers
   * nothing at all. A clock that kept running under either would divide a time
   * that grew by a numerator that did not.
   */
  elapsedMs: number
  /**
   * The epoch millisecond the search means to resume at, while Twitch is asking
   * it to wait; null the rest of the time. What the run block counts down.
   */
  pausedUntil: number | null
  span: Span | null
  logEntries: LogEntry[]
  gameNames: ReadonlyMap<string, string>
  running: boolean
  start: (request: SearchRequest) => Promise<void>
  stop: () => void
}

/**
 * Drives one search: slice seeding, collection, and the running commentary the
 * user reads while it happens. Everything it owns is reset on each start, so a
 * second search never shows remnants of the first.
 *
 * It is given no language, and that is deliberate: a search runs for minutes and
 * its log outlives it, so every line it writes is a message left unrendered —
 * see [LogEntry]. Nothing else here has anything to say to the reader.
 */
export function useClipSearch(session: Session | null, onTokenRejected: () => void): ClipSearch {
  const [clips, setClips] = useState<Clip[]>([])
  const [reports, setReports] = useState<WindowReport[]>([])
  const [incomplete, setIncomplete] = useState<WindowReport[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [pausedUntil, setPausedUntil] = useState<number | null>(null)
  const [span, setSpan] = useState<Span | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [gameNames, setGameNames] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [running, setRunning] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const startedAtRef = useRef(0)
  /** The covered milliseconds the clock was last read at; -1 before any search. */
  const clockedAtRef = useRef(-1)
  const appendRef = useRef(makeLogAppender(LOG_LIMIT))

  /** The shape every line takes: a key, its parameters, and when to shout. */
  const log = useCallback((key: MessageKey, params?: Params, kind?: LogKind) => {
    setLogEntries(appendRef.current((t) => t(key, params), kind))
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    log('log.stopRequested', undefined, 'warn')
  }, [log])

  const start = useCallback(
    async ({ channel, since, until }: SearchRequest) => {
      if (!session) return

      const from = new Date(`${since}T00:00:00Z`)
      const to = new Date(`${until}T23:59:59Z`)
      // The interface already forbids this case; the guard stays, the hook being
      // callable without it.
      if (!(from < to)) {
        log('period.order', undefined, 'err')
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      setRunning(true)
      setClips([])
      setReports([])
      setIncomplete([])
      setProgress(null)
      startedAtRef.current = Date.now()
      clockedAtRef.current = -1
      setElapsedMs(0)
      setPausedUntil(null)
      setLogEntries([])
      setGameNames(new Map())
      setSpan({ from: from.getTime(), to: to.getTime() })

      try {
        // Said out loud as well as waited out: up to a minute of a search
        // standing still, in silence, reads as a search that has hung.
        const api = new TwitchApi(session, controller.signal, (resumesAt) => {
          setPausedUntil(resumesAt)
          if (resumesAt !== null) {
            log('log.paused', { n: Math.round((resumesAt - Date.now()) / 1000) }, 'warn')
          }
        })
        const user = await api.fetchUser(channel)
        // Remembered only here: a channel actually searched earns its place in the
        // cache, a prefix crossed while typing does not.
        channelCache.remember(user.login, user.created_at.slice(0, 10))
        log(
          'log.channel',
          { name: user.display_name, id: user.id, date: { day: user.created_at } },
          'good',
        )
        if (Date.parse(user.created_at) < from.getTime()) {
          log('log.beforeCreation', { date: { day: since } }, 'warn')
        }

        // Yearly seeding; the bisection tightens where clips are dense.
        const windows = splitByYear(from, to)
        log('log.slices', { n: windows.length })

        const result = await collectClips({
          windows,
          fetchPage: api.clipPageFetcher(user.id),
          signal: controller.signal,
          // The clock is read here rather than where the estimate is displayed:
          // a render may happen at any moment, and ground being covered is the
          // only moment that means anything. Two kinds of report are not that
          // moment, and both would break the same rule — dividing a time that
          // grew by a numerator that did not:
          //
          //   · a page landing, which moves the count the reader watches but
          //     leaves the search inside the same slice;
          //   · a slice being HALVED, which moves the slice count and covers
          //     nothing at all — its halves are about to walk the very span it
          //     just walked.
          //
          // So the clock is keyed on the covered period, which is also what the
          // bar draws and what the estimate divides by. One measure, read once.
          onProgress: (next) => {
            setProgress(next)
            if (next.coveredMs !== clockedAtRef.current) {
              clockedAtRef.current = next.coveredMs
              setElapsedMs(Date.now() - startedAtRef.current)
            }
          },
          // The table fills in during the search instead of waiting for the end.
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
              log('log.sliceSplit', window, 'warn')
            } else if (report.saturated) {
              log('log.sliceLost', window, 'err')
            } else if (report.clipCount) {
              log('log.slice', window)
            }
          },
        })

        setClips(result.clips)
        setIncomplete(result.incomplete)
        // Two counts, so two messages: one message holding both could agree
        // with neither, and wrote "1 requests" for every single-request search.
        setLogEntries(
          appendRef.current(
            (t) =>
              [
                t('log.summaryClips', { n: result.clips.length }),
                t('log.summaryRequests', { n: result.requests }),
              ].join(' · '),
            'good',
          ),
        )
        if (controller.signal.aborted) {
          log('log.interrupted', undefined, 'warn')
        }

        // Helix only returns a game id. Labelling a filter is worth one request,
        // but failing at it must not invalidate a search that succeeded — which
        // is why what comes back is kept whether it is whole or not, and only
        // the shortfall is said out loud. An abort still goes up: the search was
        // stopped, and there is nothing left to label.
        const { names, incomplete: namesIncomplete } = await api.fetchGameNames(
          result.clips.map((clip) => clip.game_id),
        )
        setGameNames(names)
        if (namesIncomplete) log('log.gameNames', undefined, 'warn')
      } catch (cause) {
        const error = cause as Error
        if (error.name === 'AbortError') return
        // The one line whose reason is itself translatable: it is rendered
        // inside the closure, in the language the log is being read in.
        setLogEntries(
          appendRef.current((t) => t('log.failed', { reason: describeError(error, t) }), 'err'),
        )
        if (error instanceof TokenRejectedError) onTokenRejected()
      } finally {
        // A pause outlives nothing: whatever ends the search ends the wait.
        setPausedUntil(null)
        setRunning(false)
        abortRef.current = null
      }
    },
    [session, log, onTokenRejected],
  )

  return {
    clips,
    reports,
    incomplete,
    progress,
    elapsedMs,
    pausedUntil,
    span,
    logEntries,
    gameNames,
    running,
    start,
    stop,
  }
}
