import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ClipTable } from './components/ClipTable'
import { Frieze, type Span } from './components/Frieze'
import { makeLogAppender, type LogEntry, type LogKind } from './log'
import { TokenRejectedError, TwitchApi } from './twitch/api'
import { authorizeUrl, clientIdStore, redirectUri, tokenStore, validateToken, type Session } from './twitch/auth'
import { collectClips, filterByMaxViews, type WindowReport } from './twitch/clips'
import type { Clip, Progress, TwitchUser } from './twitch/types'
import { splitRange } from './twitch/windows'

const DAY_MS = 86_400_000
const LOG_LIMIT = 500

const day = (date: Date) => date.toISOString().slice(0, 10)

function usePersistedState(key: string, initial: string) {
  const [value, setValue] = useState(() => localStorage.getItem(`getclip.${key}`) ?? initial)
  useEffect(() => localStorage.setItem(`getclip.${key}`, value), [key, value])
  return [value, setValue] as const
}

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const CSV_COLUMNS = ['id', 'url', 'title', 'view_count', 'created_at', 'creator_name', 'duration'] as const

function toCsv(clips: Clip[]): string {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = clips.map((clip) => CSV_COLUMNS.map((column) => cell(clip[column])).join(','))
  // Leading BOM so Excel picks up UTF-8.
  return '\uFEFF' + [CSV_COLUMNS.join(','), ...rows].join('\n')
}

export default function App({ authError }: { authError: string | null }) {
  const [clientId, setClientId] = useState(clientIdStore.read)
  // Frozen at mount: recomputing it would snap the panel shut mid-typing, and
  // would fight the user's own toggling.
  const [setupOpen] = useState(() => !clientIdStore.read())
  const [session, setSession] = useState<Session | null>(null)
  const [authMessage, setAuthMessage] = useState(
    authError ? `Twitch a refusé la connexion : ${authError}` : 'Aucun jeton. Connecte-toi à Twitch pour commencer.',
  )
  const [authKind, setAuthKind] = useState<'ok' | 'bad' | ''>(authError ? 'bad' : '')

  const [channel, setChannel] = usePersistedState('channel', 'kaliyami')
  const [since, setSince] = usePersistedState('since', '2019-01-01')
  const [until, setUntil] = usePersistedState('until', day(new Date()))
  const [chunkDays, setChunkDays] = usePersistedState('chunk', '30')
  const [maxViewsInput, setMaxViewsInput] = usePersistedState('maxViews', '')

  const [running, setRunning] = useState(false)
  const [clips, setClips] = useState<Clip[]>([])
  const [reports, setReports] = useState<WindowReport[]>([])
  const [incomplete, setIncomplete] = useState<WindowReport[]>([])
  const [span, setSpan] = useState<Span | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [channelCreatedAt, setChannelCreatedAt] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const appendRef = useRef(makeLogAppender(LOG_LIMIT))

  const log = useCallback((text: string, kind?: LogKind) => {
    setLogEntries(appendRef.current(text, kind))
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logEntries])

  // The fragment was already consumed in main.tsx; here we only confirm the
  // stored token is still live.
  useEffect(() => {
    const stored = tokenStore.read()
    if (!stored) return

    validateToken(stored)
      .then((validated) => {
        setSession(validated)
        setClientId(validated.clientId)
        setAuthMessage(`Connecté — jeton valide encore ${Math.round(validated.expiresInSeconds / 3600)} h.`)
        setAuthKind('ok')
      })
      .catch(() => {
        tokenStore.clear()
        setAuthMessage('Jeton expiré. Reconnecte-toi.')
        setAuthKind('bad')
      })
  }, [])

  const connect = () => {
    const trimmed = clientId.trim()
    if (!trimmed) {
      setAuthMessage('Renseigne le Client ID de ton application ci-dessous.')
      setAuthKind('bad')
      return
    }
    clientIdStore.write(trimmed)
    location.href = authorizeUrl(trimmed, redirectUri())
  }

  const maxViews = maxViewsInput.trim() === '' ? null : Number(maxViewsInput)
  const shown = useMemo(
    () => filterByMaxViews(clips, maxViews !== null && Number.isFinite(maxViews) ? maxViews : null),
    [clips, maxViews],
  )

  const run = async () => {
    if (running) {
      abortRef.current?.abort()
      log('Arrêt demandé.', 'warn')
      return
    }
    if (!session) {
      setAuthMessage('Connecte-toi à Twitch avant de lancer la fouille.')
      setAuthKind('bad')
      return
    }

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
    setSpan({ from: from.getTime(), to: to.getTime() })

    try {
      const api = new TwitchApi(session, controller.signal)
      const user: TwitchUser = await api.fetchUser(channel)
      setChannelCreatedAt(user.created_at.slice(0, 10))
      log(`Chaîne : ${user.display_name} (id ${user.id}), créée le ${user.created_at.slice(0, 10)}.`, 'good')
      if (Date.parse(user.created_at) < from.getTime()) {
        log(`La chaîne est antérieure au ${since} : les clips plus anciens sont hors périmètre.`, 'warn')
      }

      const windows = splitRange(from, to, Math.max(1, Number(chunkDays) || 30) * DAY_MS)
      log(`${windows.length} fenêtres de ${chunkDays} jours à explorer.`)

      const result = await collectClips({
        windows,
        fetchPage: api.clipPageFetcher(user.id),
        signal: controller.signal,
        onProgress: setProgress,
        onWindow: (report) => {
          setReports((previous) => [...previous, report])
          const label = `${report.window.startedAt.slice(0, 10)} → ${report.window.endedAt.slice(0, 10)}`
          const pad = '  '.repeat(report.depth)
          if (report.split) log(`${pad}${label} saturée (${report.clipCount}), recoupée en deux`, 'warn')
          else if (report.saturated) log(`${pad}${label} : ${report.clipCount} clips — encore saturée au plancher, des clips manquent`, 'err')
          else if (report.clipCount) log(`${pad}${label} : ${report.clipCount} clips`)
        },
      })

      setClips(result.clips)
      setIncomplete(result.incomplete)
      log(`${result.clips.length} clips uniques en ${result.requests} requêtes.`, 'good')
      if (controller.signal.aborted) log('Fouille interrompue : le résultat est partiel.', 'warn')
    } catch (cause) {
      const error = cause as Error
      if (error.name === 'AbortError') return
      log(`Échec : ${error.message}`, 'err')
      if (error instanceof TokenRejectedError) {
        // Drop the session, otherwise the disabled connect button traps the user.
        tokenStore.clear()
        setSession(null)
        setAuthMessage('Jeton expiré. Reconnecte-toi.')
        setAuthKind('bad')
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const stamp = `${channel || 'clips'}_${day(new Date())}`

  return (
    <div className="page">
      <header>
        <h1>GetClipTwitch</h1>
        <p className="lede">L'inventaire complet des clips d'une chaîne, du plus vu au jamais vu.</p>
      </header>

      <div className="layout">
        <aside className="rail">
          <p className="eyebrow">Accès</p>
          <div className={`status ${authKind}`}>{authMessage}</div>
          <button type="button" className="primary wide" onClick={connect} disabled={session !== null}>
            {session ? 'Connecté à Twitch' : 'Se connecter à Twitch'}
          </button>

          <details open={setupOpen}>
            <summary>Configurer une application</summary>
            <p>
              Le Client ID identifie l'application, pas ton compte : il n'est pas secret. Tu te connectes
              ensuite avec ton propre compte Twitch.
            </p>
            <ol>
              <li>
                Crée une application sur{' '}
                <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer">
                  dev.twitch.tv/console/apps
                </a>
                , catégorie « Application Integration ».
              </li>
              <li>Colle exactement cette adresse dans « OAuth Redirect URLs » :</li>
            </ol>
            <div className="copyline">
              <input readOnly value={redirectUri()} />
              <button type="button" onClick={() => void navigator.clipboard.writeText(redirectUri())}>
                Copier
              </button>
            </div>
            <label>
              <span>Client ID</span>
              <input
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="ex. hof5gwx0su6owfnys0nyac87zr6t"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </details>

          <p className="eyebrow">Cible</p>
          <label>
            <span>Chaîne</span>
            <input value={channel} onChange={(event) => setChannel(event.target.value)} spellCheck={false} />
          </label>
          <div className="duo">
            <label>
              <span>Depuis</span>
              <input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
            </label>
            <label>
              <span>Jusqu'au</span>
              <input type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
            </label>
          </div>
          {channelCreatedAt && channelCreatedAt < since && (
            <button type="button" className="link" onClick={() => setSince(channelCreatedAt)}>
              Remonter à la création de la chaîne ({channelCreatedAt})
            </button>
          )}
          <div className="duo">
            <label>
              <span>Fenêtre (jours)</span>
              <input
                type="number"
                min={1}
                max={365}
                value={chunkDays}
                onChange={(event) => setChunkDays(event.target.value)}
              />
            </label>
            <label>
              <span>Vues max (option.)</span>
              <input
                type="number"
                min={0}
                placeholder="aucune"
                value={maxViewsInput}
                onChange={(event) => setMaxViewsInput(event.target.value)}
              />
            </label>
          </div>
          <button type="button" className="wide" onClick={() => void run()}>
            {running ? 'Arrêter' : 'Lancer la fouille'}
          </button>
        </aside>

        <main className="stage">
          <p className="eyebrow">Découpage du temps</p>
          <Frieze reports={reports} span={span} />
          <div className="legend">
            <span>
              <b className="done" />
              fenêtre complète
            </span>
            <span>
              <b className="split" />
              saturée, recoupée
            </span>
            <span>
              <b className="lost" />
              saturée au plancher — clips manquants
            </span>
          </div>

          <dl className="tally">
            <div>
              <dt>Fenêtres</dt>
              <dd>{progress ? `${progress.windowsDone}/${progress.windowsTotal}` : '0'}</dd>
            </div>
            <div>
              <dt>Requêtes</dt>
              <dd>{progress?.requests ?? 0}</dd>
            </div>
            <div>
              <dt>Clips uniques</dt>
              <dd>{clips.length || progress?.clipsFound || 0}</dd>
            </div>
            <div>
              <dt>Affichés</dt>
              <dd>{shown.length}</dd>
            </div>
          </dl>

          {incomplete.length > 0 && (
            <p className="alert">
              {incomplete.length} fenêtre(s) encore saturée(s) au plancher de 6 h : le résultat n'est pas
              exhaustif sur ces périodes. Réduis la fenêtre de départ ou resserre l'intervalle de dates.
            </p>
          )}

          <p className="eyebrow">Journal</p>
          <div className="log" ref={logRef}>
            {logEntries.length === 0 ? (
              <p>En attente.</p>
            ) : (
              logEntries.map((entry) => (
                <p key={entry.id} className={entry.kind}>
                  {entry.text}
                </p>
              ))
            )}
          </div>

          <p className="eyebrow">Résultats</p>
          <div className="bar">
            <button type="button" disabled={!shown.length} onClick={() => download(`${stamp}.csv`, toCsv(shown), 'text/csv')}>
              CSV
            </button>
            <button
              type="button"
              disabled={!shown.length}
              onClick={() => download(`${stamp}.json`, JSON.stringify(shown, null, 2), 'application/json')}
            >
              JSON
            </button>
            <button
              type="button"
              disabled={!shown.length}
              onClick={() => download(`${stamp}_urls.txt`, shown.map((clip) => clip.url).join('\n'), 'text/plain')}
            >
              URLs
            </button>
            <span className="count">
              {shown.length
                ? `${shown.length} clips affichés${maxViews !== null ? ` sur ${clips.length} récupérés` : ''}`
                : ''}
            </span>
          </div>
          <ClipTable clips={shown} />
        </main>
      </div>
    </div>
  )
}
