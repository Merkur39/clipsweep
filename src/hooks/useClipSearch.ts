import { useCallback, useRef, useState } from 'react'

import { channelCache } from '../domain/channelCache'
import { makeLogAppender, type LogEntry, type LogKind } from '../domain/log'
import { formatCount } from '../domain/numbers'
import { TokenRejectedError, TwitchApi } from '../twitch/api'
import type { Session } from '../twitch/auth'
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
export function useClipSearch(session: Session | null, onTokenRejected: () => void): ClipSearch {
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
    log('Arrêt demandé.', 'warn')
  }, [log])

  const start = useCallback(
    async ({ channel, since, until }: SearchRequest) => {
      if (!session) return

      const from = new Date(`${since}T00:00:00Z`)
      const to = new Date(`${until}T23:59:59Z`)
      if (!(from < to)) {
        log('La date de début doit précéder la date de fin.', 'err')
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
        // Retenue seulement ici : une chaîne réellement fouillée mérite sa place
        // en cache, un préfixe croisé au fil de la frappe non.
        channelCache.remember(user.login, user.created_at.slice(0, 10))
        log(
          `Chaîne : ${user.display_name} (id ${user.id}), créée le ${user.created_at.slice(0, 10)}.`,
          'good',
        )
        if (Date.parse(user.created_at) < from.getTime()) {
          log(
            `La chaîne est antérieure au ${since} : les clips plus anciens sont hors périmètre.`,
            'warn',
          )
        }

        // Yearly seeding; the bisection tightens where clips are dense.
        const windows = splitByYear(from, to)
        log(`${windows.length} fenêtre(s) annuelle(s) à explorer, resserrées si besoin.`)

        const result = await collectClips({
          windows,
          fetchPage: api.clipPageFetcher(user.id),
          signal: controller.signal,
          onProgress: setProgress,
          // La table se remplit pendant la fouille au lieu d'attendre la fin.
          onClips: setClips,
          onWindow: (report) => {
            setReports((previous) => [...previous, report])
            const label = `${report.window.startedAt.slice(0, 10)} → ${report.window.endedAt.slice(0, 10)}`
            const pad = '  '.repeat(report.depth)
            if (report.split) {
              log(`${pad}${label} saturée (${report.clipCount}), recoupée en deux`, 'warn')
            } else if (report.saturated) {
              log(
                `${pad}${label} : ${report.clipCount} clips — encore saturée au plancher, des clips manquent`,
                'err',
              )
            } else if (report.clipCount) {
              log(`${pad}${label} : ${report.clipCount} clips`)
            }
          },
        })

        setClips(result.clips)
        setIncomplete(result.incomplete)
        log(
          `${formatCount(result.clips.length)} clips uniques en ${formatCount(result.requests)} requêtes.`,
          'good',
        )
        if (controller.signal.aborted) {
          log('Fouille interrompue : le résultat est partiel.', 'warn')
        }

        // Helix only returns a game id. Labelling a filter is worth one request,
        // but failing at it must not invalidate a search that succeeded.
        try {
          setGameNames(await api.fetchGameNames(result.clips.map((clip) => clip.game_id)))
        } catch {
          log('Noms des jeux indisponibles : le filtre listera les identifiants.', 'warn')
        }
      } catch (cause) {
        const error = cause as Error
        if (error.name === 'AbortError') return
        log(`Échec : ${error.message}`, 'err')
        if (error instanceof TokenRejectedError) onTokenRejected()
      } finally {
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
    span,
    logEntries,
    gameNames,
    running,
    start,
    stop,
  }
}
