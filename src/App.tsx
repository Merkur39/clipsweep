import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ClipTable } from './components/ClipTable'
import { Frieze, type Span } from './components/Frieze'
import { makeLogAppender, type LogEntry, type LogKind } from './log'
import { describeEmptyResults } from './results'
import { buildDownloadScript, detectScriptFlavor, type ScriptFlavor } from './scripts'
import { selectedClips, toggle, toggleAll } from './selection'
import { TokenRejectedError, TwitchApi } from './twitch/api'
import {
  authorizeUrl,
  BUILD_TIME_CLIENT_ID,
  clientIdStore,
  redirectUri,
  resolveClientId,
  tokenStore,
  validateToken,
  type Session,
} from './twitch/auth'
import { applyFilters, facets, type ClipFilters } from './filters'
import { collectClips, type WindowReport } from './twitch/clips'
import type { Clip, Progress, TwitchUser } from './twitch/types'
import { splitRange } from './twitch/windows'

const DAY_MS = 86_400_000
const LOG_LIMIT = 500

const day = (date: Date) => date.toISOString().slice(0, 10)

const numberOrNull = (raw: string) => {
  const value = Number(raw.trim())
  return raw.trim() === '' || !Number.isFinite(value) ? null : value
}

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

const CSV_COLUMNS = [
  'id',
  'url',
  'title',
  'view_count',
  'created_at',
  'creator_name',
  'duration',
] as const

function toCsv(clips: Clip[]): string {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = clips.map((clip) => CSV_COLUMNS.map((column) => cell(clip[column])).join(','))
  // Leading BOM so Excel picks up UTF-8.
  return '\uFEFF' + [CSV_COLUMNS.join(','), ...rows].join('\n')
}

export default function App({ authError }: { authError: string | null }) {
  const [clientId, setClientId] = useState(() =>
    resolveClientId(clientIdStore.read(), BUILD_TIME_CLIENT_ID),
  )
  const [session, setSession] = useState<Session | null>(null)
  const [authMessage, setAuthMessage] = useState(
    authError
      ? `Twitch a refusé la connexion : ${authError}`
      : 'Aucun jeton. Connecte-toi à Twitch pour commencer.',
  )
  const [authKind, setAuthKind] = useState<'ok' | 'bad' | ''>(authError ? 'bad' : '')

  const [channel, setChannel] = usePersistedState('channel', 'kaliyami')
  const [since, setSince] = usePersistedState('since', '2019-01-01')
  const [until, setUntil] = usePersistedState('until', day(new Date()))
  const [chunkDays, setChunkDays] = usePersistedState('chunk', '30')
  // Filtres d'affichage : ils portent sur les clips déjà récupérés, jamais sur
  // la fouille elle-même. Non persistés, contrairement aux champs de recherche —
  // un seuil oublié d'une session à l'autre donne une table vide inexpliquée.
  const [minViewsInput, setMinViewsInput] = useState('')
  const [maxViewsInput, setMaxViewsInput] = useState('')
  const [creator, setCreator] = useState('')
  const [gameId, setGameId] = useState('')
  const [gameNames, setGameNames] = useState<ReadonlyMap<string, string>>(() => new Map())

  const [running, setRunning] = useState(false)
  const [clips, setClips] = useState<Clip[]>([])
  const [reports, setReports] = useState<WindowReport[]>([])
  const [incomplete, setIncomplete] = useState<WindowReport[]>([])
  const [span, setSpan] = useState<Span | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [channelCreatedAt, setChannelCreatedAt] = useState<string | null>(null)
  // Exclusions, not selections: everything starts checked, including clips that
  // appear later when the threshold is raised.
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(() => new Set())
  // Read once: the visitor's machine does not change mid-session.
  const [flavor] = useState(() =>
    detectScriptFlavor({
      platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform,
      userAgent: navigator.userAgent,
    }),
  )
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
        setAuthMessage(
          `Connecté — jeton valide encore ${Math.round(validated.expiresInSeconds / 3600)} h.`,
        )
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
      setAuthMessage('Aucune application configurée : renseigne un Client ID ci-dessous.')
      setAuthKind('bad')
      return
    }
    // Only an actual override is worth persisting.
    if (trimmed !== BUILD_TIME_CLIENT_ID) clientIdStore.write(trimmed)
    location.href = authorizeUrl(trimmed, redirectUri())
  }

  const maxViews = numberOrNull(maxViewsInput)
  const filters: ClipFilters = {
    minViews: numberOrNull(minViewsInput),
    maxViews,
    creator: creator || null,
    gameId: gameId || null,
  }
  const shown = useMemo(
    () => applyFilters(clips, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filters` est recréé à chaque rendu
    [clips, filters.minViews, filters.maxViews, filters.creator, filters.gameId],
  )
  const creatorFacets = useMemo(() => facets(clips, (clip) => clip.creator_name), [clips])
  const gameFacets = useMemo(() => facets(clips, (clip) => clip.game_id), [clips])

  const filtersActive = Boolean(minViewsInput || maxViewsInput || creator || gameId)
  const resetFilters = () => {
    setMinViewsInput('')
    setMaxViewsInput('')
    setCreator('')
    setGameId('')
  }
  const selected = useMemo(() => selectedClips(shown, deselected), [shown, deselected])

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
    setDeselected(new Set())
    setGameNames(new Map())
    setMinViewsInput('')
    setMaxViewsInput('')
    setCreator('')
    setGameId('')
    setReports([])
    setIncomplete([])
    setProgress(null)
    setLogEntries([])
    setSpan({ from: from.getTime(), to: to.getTime() })

    try {
      const api = new TwitchApi(session, controller.signal)
      const user: TwitchUser = await api.fetchUser(channel)
      setChannelCreatedAt(user.created_at.slice(0, 10))
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
          if (report.split)
            log(`${pad}${label} saturée (${report.clipCount}), recoupée en deux`, 'warn')
          else if (report.saturated)
            log(
              `${pad}${label} : ${report.clipCount} clips — encore saturée au plancher, des clips manquent`,
              'err',
            )
          else if (report.clipCount) log(`${pad}${label} : ${report.clipCount} clips`)
        },
      })

      setClips(result.clips)
      setIncomplete(result.incomplete)
      log(`${result.clips.length} clips uniques en ${result.requests} requêtes.`, 'good')
      if (controller.signal.aborted) log('Fouille interrompue : le résultat est partiel.', 'warn')

      // Helix ne renvoie qu'un game_id : sans cette résolution, le filtre par
      // jeu n'offrirait que des identifiants numériques. Accessoire, donc un
      // échec ici ne doit pas invalider la fouille.
      try {
        const names = await api.fetchGameNames(result.clips.map((clip) => clip.game_id))
        setGameNames(names)
      } catch {
        log('Noms des jeux indisponibles : le filtre listera les identifiants.', 'warn')
      }
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

  const downloadLabel = selected.length
    ? `Télécharger ${selected.length === 1 ? 'le clip' : `les ${selected.length} clips`}`
    : 'Télécharger les clips'

  const downloadScript = (target: ScriptFlavor) =>
    download(
      `${stamp}.${target}`,
      buildDownloadScript(
        target,
        channel,
        selected.map((clip) => clip.url),
      ),
      'text/plain',
    )

  return (
    <div className="page">
      <header>
        <h1>GetClipTwitch</h1>
        <p className="lede">
          L'inventaire complet des clips d'une chaîne, du plus vu au jamais vu.
        </p>
      </header>

      <div className="layout">
        <aside className="rail">
          <p className="eyebrow">Accès</p>
          <div className={`status ${authKind}`}>{authMessage}</div>
          <button
            type="button"
            className="primary wide"
            onClick={connect}
            disabled={session !== null}
          >
            {session ? 'Connecté à Twitch' : 'Se connecter à Twitch'}
          </button>

          {/* Auto-hébergement seulement : sur le site déployé, l'application est
              buildée et le visiteur n'a rien à configurer. */}
          {!BUILD_TIME_CLIENT_ID && (
            <details open>
              <summary>Configurer une application</summary>
              <p>
                Le Client ID identifie l'application, pas ton compte : il n'est pas secret. Tu te
                connectes ensuite avec ton propre compte Twitch.
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
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(redirectUri())}
                >
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
          )}

          <p className="eyebrow">Cible</p>
          <label>
            <span>Chaîne</span>
            <input
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              spellCheck={false}
            />
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
              <dt>Sélectionnés</dt>
              <dd>{selected.length}</dd>
            </div>
          </dl>

          {incomplete.length > 0 && (
            <p className="alert">
              {incomplete.length} fenêtre(s) encore saturée(s) au plancher de 6 h : le résultat
              n'est pas exhaustif sur ces périodes. Réduis la fenêtre de départ ou resserre
              l'intervalle de dates.
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

          <div className="filters">
            <label>
              <span>Vues min</span>
              <input
                type="number"
                min={0}
                placeholder="aucune"
                value={minViewsInput}
                onChange={(event) => setMinViewsInput(event.target.value)}
              />
            </label>
            <label>
              <span>Vues max</span>
              <input
                type="number"
                min={0}
                placeholder="aucune"
                value={maxViewsInput}
                onChange={(event) => setMaxViewsInput(event.target.value)}
              />
            </label>
            <label>
              <span>Créateur</span>
              <select value={creator} onChange={(event) => setCreator(event.target.value)}>
                <option value="">Tous</option>
                {creatorFacets.map((facet) => (
                  <option key={facet.value} value={facet.value}>
                    {facet.value} ({facet.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Jeu</span>
              <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
                <option value="">Tous</option>
                {gameFacets.map((facet) => (
                  <option key={facet.value} value={facet.value}>
                    {gameNames.get(facet.value) ?? facet.value} ({facet.count})
                  </option>
                ))}
              </select>
            </label>
            {filtersActive && (
              <button type="button" className="link" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          <ClipTable
            clips={shown}
            deselected={deselected}
            onToggle={(id) => setDeselected((previous) => toggle(previous, id))}
            onToggleAll={() => setDeselected((previous) => toggleAll(shown, previous))}
            emptyMessage={describeEmptyResults({
              searched: progress !== null,
              clipsFound: clips.length,
              maxViews,
            })}
            emptyAction={
              clips.length > 0 && maxViews !== null
                ? {
                    label: `Voir les ${clips.length}`,
                    onClick: () => setMaxViewsInput(''),
                  }
                : undefined
            }
          />

          <section className="group">
            <h2>Télécharger les vidéos</h2>
            <p className="group-lede">
              Un script à lancer sur ta machine : il installe yt-dlp au besoin, puis récupère les
              clips.
            </p>
            <div className="group-actions">
              {(flavor ?? 'bat') === 'bat' && (
                <button
                  type="button"
                  className={flavor ? 'primary' : ''}
                  disabled={!selected.length}
                  title="Enregistrer dans un dossier, puis double-cliquer."
                  onClick={() => downloadScript('bat')}
                >
                  {flavor ? downloadLabel : 'Script Windows (.bat)'}
                </button>
              )}
              {(flavor ?? 'sh') === 'sh' && (
                <button
                  type="button"
                  className={flavor ? 'primary' : ''}
                  disabled={!selected.length}
                  title="Enregistrer, puis : chmod +x fichier.sh && ./fichier.sh"
                  onClick={() => downloadScript('sh')}
                >
                  {flavor ? downloadLabel : 'Script macOS · Linux (.sh)'}
                </button>
              )}
            </div>
            {flavor && (
              <p className="hint">
                {flavor === 'bat'
                  ? 'Script Windows (.bat) — enregistrer dans un dossier, puis double-cliquer. '
                  : 'Script macOS · Linux (.sh) — enregistrer, puis chmod +x et lancer. '}
                <br />
                <button
                  type="button"
                  className="link"
                  disabled={!selected.length}
                  onClick={() => downloadScript(flavor === 'bat' ? 'sh' : 'bat')}
                >
                  {flavor === 'bat' ? 'Je suis sur macOS ou Linux' : 'Je suis sur Windows'}
                </button>
              </p>
            )}
          </section>

          <section className="group">
            <h2>Exporter la liste</h2>
            <p className="group-lede">
              Les métadonnées des clips, sans les vidéos — pour un tableur ou un autre outil.
            </p>
            <div className="group-actions">
              <button
                type="button"
                disabled={!selected.length}
                onClick={() => download(`${stamp}.csv`, toCsv(selected), 'text/csv')}
              >
                CSV
              </button>
              <button
                type="button"
                disabled={!selected.length}
                onClick={() =>
                  download(`${stamp}.json`, JSON.stringify(selected, null, 2), 'application/json')
                }
              >
                JSON
              </button>
              <button
                type="button"
                disabled={!selected.length}
                title="Une URL par ligne, pour yt-dlp -a"
                onClick={() =>
                  download(
                    `${stamp}_urls.txt`,
                    selected.map((clip) => clip.url).join('\n'),
                    'text/plain',
                  )
                }
              >
                URLs
              </button>
              <span className="count">
                {clips.length
                  ? `${selected.length} sélectionné${selected.length > 1 ? 's' : ''} sur ${clips.length} récupéré${clips.length > 1 ? 's' : ''}`
                  : ''}
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
