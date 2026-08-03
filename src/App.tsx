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
  // Read once only, before the first render: that is what allows announcing
  // "checking" rather than "no token" during the round trip.
  const [storedToken] = useState(() => tokenStore.read())
  // Is the token supposed to exist? Disconnecting and rejection deny it, and
  // that is the only thing the state holds — the message itself is derived.
  const [hasToken, setHasToken] = useState(() => storedToken !== null)
  /**
   * What the application has to say on top of the derived access state: a token
   * just refused, a sweep started too early.
   *
   * A **key**, never a text: a message frozen at the moment it was set would
   * stay in the language of that moment, and switching languages would leave an
   * orphan sentence in the middle of a translated interface.
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
  // A confirmed session outranks any notice: it is what makes them stale.
  const authMessage = session
    ? t('access.connectedFor', { life: describeTokenLife(session.expiresInSeconds, t) })
    : (notice && t(notice.key)) || access.message
  const authKind: AccessKind = session ? 'ok' : (notice?.kind ?? access.kind)

  // Already set on `<html>` by `main.tsx` before the first render; the effect
  // only serves the changes that follow.
  const [storedTheme, setTheme] = usePersistedState('theme', 'system')
  const theme = parseTheme(storedTheme)
  useEffect(() => applyTheme(document.documentElement, theme), [theme])

  // The target and the period live for the tab's lifetime, unlike the theme:
  // they are the parameters of a sweep, not preferences. Finding them again
  // from one session to the next would restart, on the first click, a search
  // nobody asked for here.
  const [channel, setChannel] = usePersistedState('channel', '', sessionStorage)
  // One month, not the dawn of Twitch: the default sweep must stay cheap, an
  // immediate click on "Start" not being allowed to commit seven yearly windows
  // before the period has been chosen.
  const [since, setSince] = usePersistedState('since', monthBefore(day(new Date())), sessionStorage)
  const [until, setUntil] = usePersistedState('until', day(new Date()), sessionStorage)
  // Display filters: they bear on the clips already collected, never on the
  // sweep itself. Not persisted, unlike the search fields — a threshold
  // forgotten between two screens gives an unexplained empty table.
  const [minViewsInput, setMinViewsInput] = useState('')
  const [maxViewsInput, setMaxViewsInput] = useState('')
  // The display range, distinct from the period swept: narrowing it restarts
  // nothing, which is the whole point.
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

  // A running sweep, or its results on screen, live in the application's memory
  // alone: leaving the page loses them and forces a full re-sweep, Helix quota
  // included.
  useUnloadGuard(running || clips.length > 0)

  // The fragment was already consumed in main.tsx; here we only confirm the
  // stored token is still live.
  useEffect(() => {
    if (!storedToken) return

    validateToken(storedToken)
      .then(setSession)
      // The optimistic bet takes itself back here, and only here.
      .catch(() => {
        tokenStore.clear()
        setHasToken(false)
        setNotice({ key: 'access.tokenExpired', kind: 'bad' })
      })
  }, [storedToken])

  const connect = () => location.assign(authorizeUrl(BUILD_TIME_CLIENT_ID, redirectUri()))

  /**
   * Forgets the token, nothing more: the clips already collected stay on screen
   * and stay exportable, since none of that asks the network again.
   *
   * The forgetting is local. The token stays valid on Twitch's side until it
   * expires — revoking it would take a call to `/oauth2/revoke`, outside what
   * the tool does today. It lives in `sessionStorage`, so it dies with the tab.
   */
  const disconnect = () => {
    tokenStore.clear()
    setSession(null)
    setHasToken(false)
    setNotice(null)
  }

  const channelCreatedAt = useChannelLookup(session, channel)
  // Derived, never written back into the state: `since` keeps the input, which
  // becomes valid again as typed if the target channel changes to an older one.
  // This is the value that displays and that goes to the sweep.
  const effectiveSince = clampSince(since, channelCreatedAt)
  // Recomputed on every render: a session left open past UTC midnight unlocks
  // the following day by itself.
  const today = day(new Date())
  const effectiveUntil = clampUntil(until, today)
  // The bounds constrain each date separately, never their order: that is the
  // only disorder still possible.
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
  // Bounds for the range fields: the actual extent of the clips in hand, which
  // grows along with the sweep, like the facets.
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
   * The escape hatch for a table emptied by a filter: it reopens the one the
   * message has just named, and therefore follows the same precedence — the
   * range first, since that is what the user just narrowed by hand.
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
    // The optimistic bet opens a window — the length of one request — where we
    // display as connected without being so yet. It is too short to reach with
    // a mouse, but not too short to lie in.
    if (!session) {
      setNotice(
        presumedConnected
          ? { key: 'access.verifying', kind: '' }
          : { key: 'access.required', kind: 'bad' },
      )
      return
    }
    // A new sweep starts from a blank selection and blank filters: keeping a
    // threshold from the previous sweep would give an unexplained empty table.
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
        {/* Two display preferences of equal standing, hence of equal shape,
            filed together at the end of the masthead. */}
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

          {/* The blanket reset lives at the end of the label, not in the row:
              there it stole a column, while every control already carries its
              own reset. Always rendered — its appearing would shift the label's
              rule. */}
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

      {/* Outside `.layout`: it runs under the rail as under the stage, with the
          masthead answering it at the top of the page. */}
      <Colophon />
    </div>
  )
}
