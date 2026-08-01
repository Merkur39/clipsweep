import { useCallback, useEffect, useMemo, useState } from 'react'

import { ClipTable } from './components/ClipTable'
import { ExportPanel } from './components/ExportPanel'
import { FiltersBar } from './components/FiltersBar'
import { SearchPanel } from './components/SearchPanel'
import { SearchProgress } from './components/SearchProgress'
import { applyFilters, facets } from './domain/filters'
import { describeEmptyResults, describeResultCount } from './domain/results'
import { buildDownloadScript, detectScriptFlavor } from './domain/scripts'
import { selectedClips, toggle, toggleAll } from './domain/selection'
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
  const [authMessage, setAuthMessage] = useState(() => {
    if (authError) return `Twitch a refusé la connexion : ${authError}`
    // Auto-hébergement mal configuré : sans identifiant, aucun bouton ne peut
    // rien faire — autant dire tout de suite quoi renseigner, et où.
    if (!BUILD_TIME_CLIENT_ID) {
      return `Aucune application configurée. Renseigne VITE_TWITCH_CLIENT_ID dans .env.local, et déclare ${redirectUri()} dans les « OAuth Redirect URLs » de ton application Twitch.`
    }
    return 'Aucun jeton. Connecte-toi à Twitch pour commencer.'
  })
  const [authKind, setAuthKind] = useState<'ok' | 'bad' | ''>(
    authError || !BUILD_TIME_CLIENT_ID ? 'bad' : '',
  )

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
    setAuthMessage('Jeton expiré. Reconnecte-toi.')
    setAuthKind('bad')
  }, [])

  const search = useClipSearch(session, onTokenRejected)
  const { clips, reports, incomplete, progress, span, logEntries, gameNames, running } = search

  // The fragment was already consumed in main.tsx; here we only confirm the
  // stored token is still live.
  useEffect(() => {
    const stored = tokenStore.read()
    if (!stored) return

    validateToken(stored)
      .then((validated) => {
        setSession(validated)
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

  const connect = () => location.assign(authorizeUrl(BUILD_TIME_CLIENT_ID, redirectUri()))

  const channelCreatedAt = useChannelLookup(session, channel)

  const maxViews = numberOrNull(maxViewsInput)
  const minViews = numberOrNull(minViewsInput)
  const shown = useMemo(
    () => applyFilters(clips, { minViews, maxViews, creators, gameIds }),
    [clips, minViews, maxViews, creators, gameIds],
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
    if (!session) {
      setAuthMessage('Connecte-toi à Twitch avant de lancer la fouille.')
      setAuthKind('bad')
      return
    }
    // Une nouvelle fouille repart d'une sélection et de filtres vierges : garder
    // un seuil de la fouille précédente donnerait une table vide inexpliquée.
    setDeselected(new Set())
    resetFilters()
    void search.start({ channel, since, until })
  }

  const stamp = `${channel || 'clips'}_${day(new Date())}`

  return (
    <div className="page">
      <header>
        <h1>GetClipTwitch</h1>
        <p className="lede">
          L'inventaire complet des clips d'une chaîne, du plus vu au jamais vu.
        </p>
      </header>

      <div className="layout">
        <SearchPanel
          authMessage={authMessage}
          authKind={authKind}
          connected={session !== null}
          canConnect={Boolean(BUILD_TIME_CLIENT_ID)}
          onConnect={connect}
          channel={channel}
          onChannelChange={setChannel}
          since={since}
          onSinceChange={setSince}
          until={until}
          onUntilChange={setUntil}
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

          <p className="eyebrow">Résultats</p>
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
              clipsFound: clips.length,
              maxViews,
            })}
            emptyAction={
              clips.length > 0 && maxViews !== null
                ? { label: `Voir les ${clips.length}`, onClick: () => setMaxViewsInput('') }
                : undefined
            }
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
