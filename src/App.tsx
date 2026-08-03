import { useCallback, useEffect, useMemo, useState } from 'react'

import { ClipTable } from './components/ClipTable'
import { Colophon } from './components/Colophon'
import { ExportPanel } from './components/ExportPanel'
import { FiltersBar } from './components/FiltersBar'
import { SearchPanel } from './components/SearchPanel'
import { Mark } from './components/Icon'
import { LocaleToggle } from './components/LocaleToggle'
import { SearchProgress } from './components/SearchProgress'
import { ThemeToggle } from './components/ThemeToggle'
import { applyTheme, parseTheme } from './domain/theme'
import { describeAccess, describeTokenLife } from './domain/access'
import { applyFilters, dateExtent, facets } from './domain/filters'
import { clampSince, clampUntil, describePeriodError, monthBefore } from './domain/period'
import { describeEmptyResults, describeResultCount } from './domain/results'
import { buildDownloadScript, detectScriptFlavor } from './domain/scripts'
import { selectedClips, toggle, toggleAll } from './domain/selection'
import { DEFAULT_SORT, nextSort, sortClips, type ClipSort } from './domain/sort'
import { useTranslation } from './i18n/LocaleProvider'
import { useChannelLookup } from './hooks/useChannelLookup'
import { useClipSearch } from './hooks/useClipSearch'
import { usePersistedState } from './hooks/usePersistedState'
import { useUnloadGuard } from './hooks/useUnloadGuard'
import {
  authorizeUrl,
  BUILD_TIME_CLIENT_ID,
  redirectUri,
  tokenStore,
  validateToken,
  type Session,
} from './twitch/auth'
import type { AccessKind } from './domain/access'
import type { MessageKey } from './i18n/messages.fr'
import type { Clip } from './twitch/types'

const day = (date: Date) => date.toISOString().slice(0, 10)

const numberOrNull = (raw: string) => {
  const value = Number(raw.trim())
  return raw.trim() === '' || !Number.isFinite(value) ? null : value
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
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  // Lu une seule fois, avant le premier rendu : c'est ce qui permet d'annoncer
  // « vérification » plutôt que « aucun jeton » pendant l'aller-retour.
  const [storedToken] = useState(() => tokenStore.read())
  // Le jeton est-il censé exister ? La déconnexion et le rejet le démentent,
  // et c'est la seule chose que l'état retienne — le message, lui, se dérive.
  const [hasToken, setHasToken] = useState(() => storedToken !== null)
  /**
   * Ce que l'application a à dire par-dessus l'état d'accès dérivé : un jeton
   * qui vient d'être refusé, un scan lancé trop tôt.
   *
   * Une **clé**, jamais un texte : un message figé à l'instant où on l'a posé
   * resterait dans la langue d'alors, et le changement de langue laisserait une
   * phrase orpheline au milieu d'une interface traduite.
   */
  const [notice, setNotice] = useState<{ key: MessageKey; kind: AccessKind } | null>(null)

  const access = describeAccess(
    {
      authError,
      clientId: BUILD_TIME_CLIENT_ID,
      hasStoredToken: hasToken,
      redirectUri: redirectUri(),
    },
    t,
  )
  const presumedConnected = access.presumedConnected
  // Une session confirmée prime sur tout avis : c'est elle qui les périme.
  const authMessage = session
    ? t('access.connectedFor', { life: describeTokenLife(session.expiresInSeconds, t) })
    : (notice && t(notice.key)) || access.message
  const authKind: AccessKind = session ? 'ok' : (notice?.kind ?? access.kind)

  // Déjà posé sur `<html>` par `main.tsx` avant le premier rendu ; l'effet ne
  // sert qu'aux changements qui suivent.
  const [storedTheme, setTheme] = usePersistedState('theme', 'system')
  const theme = parseTheme(storedTheme)
  useEffect(() => applyTheme(document.documentElement, theme), [theme])

  // La cible et la période vivent le temps de l'onglet, contrairement au thème :
  // ce sont les paramètres d'un scan, pas des préférences. Les retrouver
  // d'une session à l'autre ferait repartir, au premier clic, une recherche que
  // personne n'a demandée ici.
  const [channel, setChannel] = usePersistedState('channel', '', sessionStorage)
  // Un mois, et non les origines de Twitch : le scan par défaut doit rester
  // bon marché, un clic immédiat sur « Lancer » ne devant pas engager sept
  // fenêtres annuelles avant que la période ait été choisie.
  const [since, setSince] = usePersistedState('since', monthBefore(day(new Date())), sessionStorage)
  const [until, setUntil] = usePersistedState('until', day(new Date()), sessionStorage)
  // Filtres d'affichage : ils portent sur les clips déjà récupérés, jamais sur
  // le scan lui-même. Non conservés, contrairement aux champs de recherche —
  // un seuil oublié d'un écran à l'autre donne une table vide inexpliquée.
  const [minViewsInput, setMinViewsInput] = useState('')
  const [maxViewsInput, setMaxViewsInput] = useState('')
  // La plage d'affichage, distincte de la période scannée : la resserrer ne
  // relance rien, c'est tout son intérêt.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
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
    setHasToken(false)
    setNotice({ key: 'access.tokenExpired', kind: 'bad' })
  }, [])

  const search = useClipSearch(session, onTokenRejected, t)
  const { clips, reports, incomplete, progress, span, logEntries, gameNames, running } = search

  // Un scan en cours, ou ses résultats à l'écran, ne vivent que dans la
  // mémoire de l'application : quitter la page les perd et impose de tout
  // rescanner, quota Helix compris.
  useUnloadGuard(running || clips.length > 0)

  // The fragment was already consumed in main.tsx; here we only confirm the
  // stored token is still live.
  useEffect(() => {
    if (!storedToken) return

    validateToken(storedToken)
      .then(setSession)
      // Le pari optimiste se dédit ici, et seulement ici.
      .catch(() => {
        tokenStore.clear()
        setHasToken(false)
        setNotice({ key: 'access.tokenExpired', kind: 'bad' })
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
    setHasToken(false)
    setNotice(null)
  }

  const channelCreatedAt = useChannelLookup(session, channel)
  // Dérivée, jamais réécrite dans l'état : `since` garde la saisie, qui
  // redeviendra valable telle quelle si la chaîne visée change pour une plus
  // ancienne. C'est cette valeur-ci qui s'affiche et qui part au scan.
  const effectiveSince = clampSince(since, channelCreatedAt)
  // Recalculé à chaque rendu : une session laissée ouverte passé minuit UTC
  // débloque le jour suivant d'elle-même.
  const today = day(new Date())
  const effectiveUntil = clampUntil(until, today)
  // Les bornes contraignent chaque date séparément, jamais leur ordre : c'est
  // le seul désordre qui reste possible.
  const periodError = describePeriodError(effectiveSince, effectiveUntil, t)

  const maxViews = numberOrNull(maxViewsInput)
  const minViews = numberOrNull(minViewsInput)
  const from = fromDate || null
  const to = toDate || null
  const shown = useMemo(
    () => sortClips(applyFilters(clips, { minViews, maxViews, from, to, creators, gameIds }), sort),
    [clips, minViews, maxViews, from, to, creators, gameIds, sort],
  )
  const creatorFacets = useMemo(() => facets(clips, (clip) => clip.creator_name), [clips])
  const gameFacets = useMemo(() => facets(clips, (clip) => clip.game_id), [clips])
  // Bornes des champs de plage : l'étendue réelle des clips en main, qui grandit
  // au fil du scan comme les facettes.
  const dateBounds = useMemo(() => dateExtent(clips), [clips])
  const gameLabel = (id: string) => gameNames.get(id) ?? id

  const filtersActive =
    Boolean(minViewsInput || maxViewsInput || fromDate || toDate) ||
    creators.length > 0 ||
    gameIds.length > 0
  const resetFilters = () => {
    setMinViewsInput('')
    setMaxViewsInput('')
    setFromDate('')
    setToDate('')
    setCreators([])
    setGameIds([])
  }
  const clearDates = () => {
    setFromDate('')
    setToDate('')
  }
  const selected = useMemo(() => selectedClips(shown, deselected), [shown, deselected])

  /**
   * L'échappatoire d'une table vidée par un filtre : elle rouvre celui que le
   * message vient de nommer, et suit donc la même préséance — la plage d'abord,
   * puisque c'est elle que l'utilisateur vient de resserrer à la main.
   */
  const reopenFilter = () => {
    if (clips.length === 0) return null
    if (from !== null || to !== null) return clearDates
    if (maxViews !== null) return () => setMaxViewsInput('')
    return null
  }
  const reopen = reopenFilter()

  const run = () => {
    if (running) {
      search.stop()
      return
    }
    // Le pari optimiste ouvre une fenêtre — le temps d'une requête — où l'on
    // s'affiche connecté sans l'être encore. Elle est trop courte pour qu'on
    // l'atteigne à la souris, mais pas pour qu'on y mente.
    if (!session) {
      setNotice(
        presumedConnected
          ? { key: 'access.verifying', kind: '' }
          : { key: 'access.required', kind: 'bad' },
      )
      return
    }
    // Un nouveau scan repart d'une sélection et de filtres vierges : garder
    // un seuil du scan précédent donnerait une table vide inexpliquée.
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
          ClipSweep
        </h1>
        <p className="lede">{t('app.tagline')}</p>
        {/* Deux préférences d'affichage de même statut, donc de même forme,
            rangées ensemble au bout de la plaque. */}
        <div className="masthead-prefs">
          <LocaleToggle />
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
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
          periodError={periodError}
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

          {/* La remise à zéro d'ensemble vit au bout de l'étiquette, pas dans la
              rangée : elle y volait une colonne, alors que chaque contrôle porte
              déjà sa propre remise à zéro. Toujours rendue — son apparition
              décalerait le filet de l'étiquette. */}
          <p className="section-label">
            {t('results.label')}
            <button
              type="button"
              className="link filters-reset"
              onClick={resetFilters}
              disabled={!filtersActive}
            >
              {t('results.reset')}
            </button>
          </p>
          {clips.length > 0 && (
            <p className="result-count">
              {describeResultCount(
                {
                  found: clips.length,
                  shown: shown.length,
                  selected: selected.length,
                },
                t,
              )}
            </p>
          )}

          <FiltersBar
            minViews={minViewsInput}
            onMinViewsChange={setMinViewsInput}
            maxViews={maxViewsInput}
            onMaxViewsChange={setMaxViewsInput}
            from={fromDate}
            onFromChange={setFromDate}
            to={toDate}
            onToChange={setToDate}
            dateBounds={dateBounds}
            creatorFacets={creatorFacets}
            creators={creators}
            onCreatorsChange={setCreators}
            gameFacets={gameFacets}
            gameIds={gameIds}
            onGameIdsChange={setGameIds}
            gameLabel={gameLabel}
          />

          <ClipTable
            clips={shown}
            deselected={deselected}
            onToggle={(id) => setDeselected((previous) => toggle(previous, id))}
            onToggleAll={() => setDeselected((previous) => toggleAll(shown, previous))}
            emptyMessage={describeEmptyResults(
              {
                searched: progress !== null,
                running,
                clipsFound: clips.length,
                maxViews,
                period: { from, to },
              },
              t,
            )}
            emptyAction={
              reopen
                ? { label: t('results.showAll', { n: clips.length }), onClick: reopen }
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
                  t,
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

      {/* Hors de `.layout` : il court sous le rail comme sous la scène, la
          plaque d'identification lui répondant en haut de page. */}
      <Colophon />
    </div>
  )
}
