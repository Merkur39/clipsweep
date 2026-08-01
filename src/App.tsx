import { useCallback, useEffect, useMemo, useState } from 'react'

import { ClipTable } from './components/ClipTable'
import { ExportPanel } from './components/ExportPanel'
import { FiltersBar } from './components/FiltersBar'
import { SearchPanel } from './components/SearchPanel'
import { Mark } from './components/Icon'
import { SearchProgress } from './components/SearchProgress'
import { describeAccess, describeTokenLife, TOKEN_EXPIRED } from './domain/access'
import { applyFilters, facets } from './domain/filters'
import { clampSince, clampUntil } from './domain/period'
import { describeEmptyResults, describeResultCount } from './domain/results'
import { buildDownloadScript, detectScriptFlavor } from './domain/scripts'
import { selectedClips, toggle, toggleAll } from './domain/selection'
import { DEFAULT_SORT, nextSort, sortClips, type ClipSort } from './domain/sort'
import { useChannelLookup } from './hooks/useChannelLookup'
import { useClipSearch } from './hooks/useClipSearch'
import {
  authorizeUrl,
  BUILD_TIME_CLIENT_ID,
  redirectUri,
  tokenStore,
  validateToken,
  type Session,
} from './twitch/auth'
import type { Clip } from './twitch/types'

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
  const [session, setSession] = useState<Session | null>(null)
  // Lu une seule fois, avant le premier rendu : c'est ce qui permet d'annoncer
  // « vérification » plutôt que « aucun jeton » pendant l'aller-retour.
  const [storedToken] = useState(() => tokenStore.read())
  const [access] = useState(() =>
    describeAccess({
      authError,
      clientId: BUILD_TIME_CLIENT_ID,
      hasStoredToken: storedToken !== null,
      redirectUri: redirectUri(),
    }),
  )
  const [authMessage, setAuthMessage] = useState(access.message)
  const [authKind, setAuthKind] = useState<'ok' | 'bad' | ''>(access.kind)
  const [presumedConnected, setPresumedConnected] = useState(access.presumedConnected)

  const [channel, setChannel] = usePersistedState('channel', 'kaliyami')
  const [since, setSince] = usePersistedState('since', '2019-01-01')
  const [until, setUntil] = usePersistedState('until', day(new Date()))
  // Filtres d'affichage : ils portent sur les clips déjà récupérés, jamais sur
  // la fouille elle-même. Non persistés, contrairement aux champs de recherche —
  // un seuil oublié d'une session à l'autre donne une table vide inexpliquée.
  const [minViewsInput, setMinViewsInput] = useState('')
  const [maxViewsInput, setMaxViewsInput] = useState('')
  const [creators, setCreators] = useState<readonly string[]>([])
  const [gameIds, setGameIds] = useState<readonly string[]>([])
  const [sort, setSort] = useState<ClipSort>(DEFAULT_SORT)
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
  const onTokenRejected = useCallback(() => {
    // Drop the session, otherwise the disabled connect button traps the user.
    tokenStore.clear()
    setSession(null)
    setPresumedConnected(false)
    setAuthMessage(TOKEN_EXPIRED)
    setAuthKind('bad')
  }, [])

  const search = useClipSearch(session, onTokenRejected)
  const { clips, reports, incomplete, progress, span, logEntries, gameNames, running } = search

  // The fragment was already consumed in main.tsx; here we only confirm the
  // stored token is still live.
  useEffect(() => {
    if (!storedToken) return

    validateToken(storedToken)
      .then((validated) => {
        setSession(validated)
        setAuthMessage(`Connecté — ${describeTokenLife(validated.expiresInSeconds)}.`)
        setAuthKind('ok')
      })
      // Le pari optimiste se dédit ici, et seulement ici.
      .catch(() => {
        tokenStore.clear()
        setPresumedConnected(false)
        setAuthMessage(TOKEN_EXPIRED)
        setAuthKind('bad')
      })
  }, [storedToken])

  const connect = () => location.assign(authorizeUrl(BUILD_TIME_CLIENT_ID, redirectUri()))

  /**
   * Oublie le jeton, rien de plus : les clips déjà récupérés restent à l'écran
   * et restent exportables, puisque rien de tout ça ne redemande le réseau.
   *
   * L'oubli est local. Le jeton reste valide côté Twitch jusqu'à son échéance —
   * le révoquer demanderait un appel à `/oauth2/revoke`, hors de ce que fait
   * l'outil aujourd'hui. Il vit en `sessionStorage`, donc il meurt avec l'onglet.
   */
  const disconnect = () => {
    tokenStore.clear()
    setSession(null)
    setPresumedConnected(false)
    const state = describeAccess({
      authError: null,
      clientId: BUILD_TIME_CLIENT_ID,
      hasStoredToken: false,
      redirectUri: redirectUri(),
    })
    setAuthMessage(state.message)
    setAuthKind(state.kind)
  }

  const channelCreatedAt = useChannelLookup(session, channel)
  // Dérivée, jamais réécrite dans l'état : `since` garde la saisie, qui
  // redeviendra valable telle quelle si la chaîne visée change pour une plus
  // ancienne. C'est cette valeur-ci qui s'affiche et qui part en fouille.
  const effectiveSince = clampSince(since, channelCreatedAt)
  // Recalculé à chaque rendu : une session laissée ouverte passé minuit UTC
  // débloque le jour suivant d'elle-même.
  const today = day(new Date())
  const effectiveUntil = clampUntil(until, today)

  const maxViews = numberOrNull(maxViewsInput)
  const minViews = numberOrNull(minViewsInput)
  const shown = useMemo(
    () => sortClips(applyFilters(clips, { minViews, maxViews, creators, gameIds }), sort),
    [clips, minViews, maxViews, creators, gameIds, sort],
  )
  const creatorFacets = useMemo(() => facets(clips, (clip) => clip.creator_name), [clips])
  const gameFacets = useMemo(() => facets(clips, (clip) => clip.game_id), [clips])
  const gameLabel = (id: string) => gameNames.get(id) ?? id

  const filtersActive =
    Boolean(minViewsInput || maxViewsInput) || creators.length > 0 || gameIds.length > 0
  const resetFilters = () => {
    setMinViewsInput('')
    setMaxViewsInput('')
    setCreators([])
    setGameIds([])
  }
  const selected = useMemo(() => selectedClips(shown, deselected), [shown, deselected])

  const run = () => {
    if (running) {
      search.stop()
      return
    }
    // Le pari optimiste ouvre une fenêtre — le temps d'une requête — où l'on
    // s'affiche connecté sans l'être encore. Elle est trop courte pour qu'on
    // l'atteigne à la souris, mais pas pour qu'on y mente.
    if (!session) {
      setAuthMessage(
        presumedConnected
          ? 'Vérification du jeton, réessaie.'
          : 'Connecte-toi à Twitch avant de lancer la fouille.',
      )
      setAuthKind(presumedConnected ? '' : 'bad')
      return
    }
    // Une nouvelle fouille repart d'une sélection et de filtres vierges : garder
    // un seuil de la fouille précédente donnerait une table vide inexpliquée.
    setDeselected(new Set())
    resetFilters()
    void search.start({ channel, since: effectiveSince, until: effectiveUntil })
  }

  const stamp = `${channel || 'clips'}_${day(new Date())}`

  return (
    <div className="page">
      {/* Plaque d'identification, pas bandeau d'accueil : l'outil se consulte
          tous les jours, son nom n'a pas besoin de 46 px. */}
      <header className="masthead">
        <h1 className="masthead-name">
          <Mark />
          GetClipTwitch
        </h1>
        <p className="lede">
          L'inventaire complet des clips d'une chaîne, du plus vu au jamais vu.
        </p>
      </header>

      <div className="layout">
        <SearchPanel
          authMessage={authMessage}
          authKind={authKind}
          connected={session !== null || presumedConnected}
          canConnect={Boolean(BUILD_TIME_CLIENT_ID)}
          onConnect={connect}
          onDisconnect={disconnect}
          channel={channel}
          onChannelChange={setChannel}
          since={effectiveSince}
          onSinceChange={setSince}
          until={effectiveUntil}
          onUntilChange={setUntil}
          today={today}
          channelCreatedAt={channelCreatedAt}
          running={running}
          onRun={run}
        />

        <main className="stage">
          <SearchProgress
            reports={reports}
            span={span}
            progress={progress}
            incomplete={incomplete}
            clipsFound={clips.length}
            logEntries={logEntries}
            running={running}
          />

          <p className="section-label">Résultats</p>
          {clips.length > 0 && (
            <p className="result-count">
              {describeResultCount({
                found: clips.length,
                shown: shown.length,
                selected: selected.length,
              })}
            </p>
          )}

          <FiltersBar
            minViews={minViewsInput}
            onMinViewsChange={setMinViewsInput}
            maxViews={maxViewsInput}
            onMaxViewsChange={setMaxViewsInput}
            creatorFacets={creatorFacets}
            creators={creators}
            onCreatorsChange={setCreators}
            gameFacets={gameFacets}
            gameIds={gameIds}
            onGameIdsChange={setGameIds}
            gameLabel={gameLabel}
            active={filtersActive}
            onReset={resetFilters}
          />

          <ClipTable
            clips={shown}
            deselected={deselected}
            onToggle={(id) => setDeselected((previous) => toggle(previous, id))}
            onToggleAll={() => setDeselected((previous) => toggleAll(shown, previous))}
            emptyMessage={describeEmptyResults({
              searched: progress !== null,
              running,
              clipsFound: clips.length,
              maxViews,
            })}
            emptyAction={
              clips.length > 0 && maxViews !== null
                ? { label: `Voir les ${clips.length}`, onClick: () => setMaxViewsInput('') }
                : undefined
            }
            sort={sort}
            onSortChange={(key) => setSort((current) => nextSort(current, key))}
          />

          <ExportPanel
            selected={selected}
            clipsFound={clips.length}
            flavor={flavor}
            onDownloadScript={(target) =>
              download(
                `${stamp}.${target}`,
                buildDownloadScript(
                  target,
                  channel,
                  selected.map((clip) => clip.url),
                ),
                'text/plain',
              )
            }
            onExportCsv={() => download(`${stamp}.csv`, toCsv(selected), 'text/csv')}
            onExportJson={() =>
              download(`${stamp}.json`, JSON.stringify(selected, null, 2), 'application/json')
            }
            onExportUrls={() =>
              download(
                `${stamp}_urls.txt`,
                selected.map((clip) => clip.url).join('\n'),
                'text/plain',
              )
            }
          />
        </main>
      </div>
    </div>
  )
}
