import { useCallback, useEffect, useMemo, useState } from 'react'

import { ClipGrid } from './components/ClipGrid'
import { ClipPlayer } from './components/ClipPlayer'
import { ClipTable } from './components/ClipTable'
import { Colophon } from './components/Colophon'
import { SelectionBar } from './components/SelectionBar'
import { FiltersBar } from './components/FiltersBar'
import { Access } from './components/Access'
import { SearchPanel } from './components/SearchPanel'
import { Mark } from './components/Icon'
import { LocaleToggle } from './components/LocaleToggle'
import { SearchProgress } from './components/SearchProgress'
import { gameLabeller } from './components/selectionLabel'
import { ThemeToggle } from './components/ThemeToggle'
import { ViewToggle } from './components/ViewToggle'
import { applyTheme, parseTheme } from './domain/theme'
import { parseView } from './domain/view'
import { describeAccess, describeTokenLife } from './domain/access'
import { applyFilters, dateExtent, facets, narrowedRange, panelOrder } from './domain/filters'
import { clampSince, clampUntil, describePeriodError, monthBefore } from './domain/period'
import { describeEmptyResults, describeResultCount } from './domain/results'
import { buildDownloadScript, detectScriptFlavor } from './domain/scripts'
import { selectedClips, toggle, toggleAll } from './domain/selection'
import { DEFAULT_SORT, nextSort, sortClips, type ClipSort, type SortKey } from './domain/sort'
import { formatCount } from './i18n/format'
import { useTranslation } from './i18n/LocaleProvider'
import { useChannelLookup } from './hooks/useChannelLookup'
import { useClipSearch } from './hooks/useClipSearch'
import { usePersistedState } from './hooks/usePersistedState'
import { useRememberedChannel } from './hooks/useRememberedChannel'
import { useUnloadGuard } from './hooks/useUnloadGuard'
import {
  authorizeUrl,
  BUILD_TIME_CLIENT_ID,
  redirectUri,
  revokeToken,
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
  const { locale, t } = useTranslation()
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

  // Which readout is on screen. A display preference, like the theme, and it
  // outlives the tab for the same reason: it says how one likes to read the
  // clips, not which clips were being read.
  const [storedView, setView] = usePersistedState('view', 'large')
  const view = parseView(storedView)

  // The target and the period live for the tab's lifetime, unlike the theme:
  // they are the parameters of a sweep, not preferences. Finding them again
  // from one session to the next would restart, on the first click, a search
  // nobody asked for here. The channel alone can be excepted from that, one
  // tick at a time — whoever sweeps their own channel types the same name at
  // every opening.
  const { channel, setChannel, remember, setRemember } = useRememberedChannel()
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
  // Selections, not exclusions: nothing starts checked, so no export ever
  // carries a clip the user never pointed at — including the ones that appear
  // later when the threshold is raised.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  // The clip being watched, held by id: the list moves underneath — a sweep goes
  // on delivering, a filter can carry one off — and an index would quietly come
  // to name another clip.
  const [playingId, setPlayingId] = useState<string | null>(null)
  // The channel as it was swept, not as the field now reads: editing the field
  // afterwards must not rewrite the heading over clips already collected.
  const [sweptChannel, setSweptChannel] = useState('')
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
   * Ends the session on both sides: forgotten here, revoked at Twitch. The clips
   * already collected stay on screen and stay exportable, since none of that
   * asks the network again.
   *
   * The forgetting comes first and never waits. A click on "Disconnect" has to
   * land whatever the network is doing — making it depend on a request would
   * leave a visitor holding a session they asked to end. Revocation follows,
   * and only its failure has anything left to say.
   */
  const disconnect = () => {
    const token = tokenStore.read()
    tokenStore.clear()
    setSession(null)
    setHasToken(false)
    setNotice(null)

    // The client the token was minted for, which validation reports, rather than
    // the one this build carries: a token from an earlier deployment would be
    // refused under the wrong id, and refused is exactly what must not happen
    // here.
    if (token) {
      void revokeToken(session?.clientId ?? BUILD_TIME_CLIENT_ID, token).catch(() =>
        setNotice({ key: 'access.revokeFailed', kind: 'bad' }),
      )
    }
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
  /**
   * What each facet is counted against: every filter **but its own**.
   *
   * A facet counted on the full sweep promises clips another filter has already
   * ruled out. Counted on `shown`, it would erase itself instead — the creators
   * list, read off a selection of creators, would hold only those already
   * checked and no second one could ever be added. Excluding its own constraint
   * is what makes "SpiZ or Ori" survive the first click.
   */
  const creatorMatching = useMemo(
    () => applyFilters(clips, { minViews, maxViews, from, to, creators: [], gameIds }),
    [clips, minViews, maxViews, from, to, gameIds],
  )
  const gameMatching = useMemo(
    () => applyFilters(clips, { minViews, maxViews, from, to, creators, gameIds: [] }),
    [clips, minViews, maxViews, from, to, creators],
  )
  const creatorFacets = useMemo(
    () => facets(clips, creatorMatching, (clip) => clip.creator_name),
    [clips, creatorMatching],
  )
  const gameFacets = useMemo(
    () =>
      panelOrder(
        facets(clips, gameMatching, (clip) => clip.game_id),
        (id) => gameNames.has(id),
      ),
    [clips, gameMatching, gameNames],
  )
  // Bounds for the range fields: the actual extent of the clips in hand, which
  // grows along with the sweep, like the facets.
  const dateBounds = useMemo(() => dateExtent(clips), [clips])
  // The range as it actually restricts. A sweep sets both bounds on the period
  // it covers, so the fields are never empty afterwards: read raw, they would
  // claim every empty table for themselves and leave the threshold on views —
  // the real culprit — unnamed.
  const narrowed = useMemo(() => narrowedRange({ from, to }, dateBounds), [from, to, dateBounds])
  const gameLabel = useMemo(() => gameLabeller(gameNames, t), [gameNames, t])

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
  const selected = useMemo(() => selectedClips(shown, selectedIds), [shown, selectedIds])
  // `selectionState` all over again, minus its pass over the clips: `selected`
  // is already the intersection the state is read from.
  const allChecked = shown.length > 0 && selected.length === shown.length
  const checkAll = () => setSelectedIds((previous) => toggleAll(shown, previous))
  const toggleClip = (id: string) => setSelectedIds((previous) => toggle(previous, id))

  /**
   * The escape hatch for a table emptied by a filter: it reopens the one the
   * message has just named, and therefore follows the same precedence — the
   * range first, since that is what the user just narrowed by hand.
   */
  const reopenFilter = () => {
    if (clips.length === 0) return null
    if (narrowed.from !== null || narrowed.to !== null) return clearDates
    if (maxViews !== null) return () => setMaxViewsInput('')
    return null
  }
  const reopen = reopenFilter()

  // Computed once for the two readouts: they go empty for the same reasons, and
  // must say so in the same words.
  const emptyMessage = describeEmptyResults(
    {
      searched: progress !== null,
      running,
      clipsFound: clips.length,
      maxViews,
      period: narrowed,
    },
    t,
  )
  const emptyAction = reopen
    ? { label: t('results.showAll', { n: clips.length }), onClick: reopen }
    : undefined
  const changeSort = (key: SortKey) => setSort((current) => nextSort(current, key))

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
    setSelectedIds(new Set())
    resetFilters()
    // The range is the exception: it opens on the period being swept rather
    // than empty. It hides nothing — nothing outside that period will be
    // collected — and it gives the two fields a starting point to narrow from,
    // instead of a blank the user has to fill in before narrowing at all.
    setFromDate(effectiveSince)
    setToDate(effectiveUntil)
    setSweptChannel(channel)
    void search.start({ channel, since: effectiveSince, until: effectiveUntil })
  }

  const stamp = `${channel || 'clips'}_${day(new Date())}`

  return (
    <div className="page">
      {/* Nameplate and preferences, nothing of the task: the tool is opened
          every day, and its name does not need to be the biggest thing on the
          page. That place belongs to the channel, once one has been swept. */}
      <header className="masthead">
        <h1 className="masthead-name">
          <Mark />
          ClipSweep
        </h1>
        <div className="masthead-prefs">
          <LocaleToggle />
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
        <Access
          message={authMessage}
          kind={authKind}
          connected={session !== null || presumedConnected}
          onDisconnect={disconnect}
        />
      </header>

      <SearchPanel
        channel={channel}
        onChannelChange={setChannel}
        remember={remember}
        onRememberChange={setRemember}
        since={effectiveSince}
        onSinceChange={setSince}
        until={effectiveUntil}
        onUntilChange={setUntil}
        today={today}
        periodError={periodError}
        channelCreatedAt={channelCreatedAt}
        connected={session !== null || presumedConnected}
        canConnect={Boolean(BUILD_TIME_CLIENT_ID)}
        onConnect={connect}
        running={running}
        onRun={run}
      />

      {/* The channel is named once a sweep has gone looking for it, and named
          as it was swept rather than as the field now reads: editing the field
          afterwards must not rewrite the heading over clips already on screen.
          Before that there is nothing to name, and the block is not rendered —
          a placeholder headline would announce a channel nobody asked for. */}
      {sweptChannel && (
        <>
          <div className="channel-head">
            <h2 className="channel-name">{sweptChannel}</h2>
            <p className="channel-tally">
              <span className="tally-figure">
                <b>{formatCount(clips.length, locale)}</b>
                {t('results.retrieved', { n: clips.length })}
              </span>
              {/* The verdict on the result's validity, beside the count it
                  qualifies rather than in the technical fold: whether clips are
                  missing is not a detail of how the algorithm went about it. */}
              {incomplete.length > 0 && (
                <span className="tally-warn">
                  {t('progress.incomplete', { n: incomplete.length })}
                </span>
              )}
            </p>
          </div>
          <div className="channel-rule" />
        </>
      )}

      <main className="stage">
        <SearchProgress
          reports={reports}
          span={span}
          progress={progress}
          clipsFound={clips.length}
          logEntries={logEntries}
          running={running}
        />

        {/* Text, not a panel: what the readout is showing on the left, what
            governs it on the right. The blanket reset lives here rather than in
            the filter row, where it stole a column from controls that each
            carry their own. */}
        <div className="toolbar">
          <div className="toolbar-left">
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
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="link filters-reset"
              onClick={resetFilters}
              disabled={!filtersActive}
            >
              {t('results.reset')}
            </button>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {clips.length > 0 && (
          <p className="result-line">
            {describeResultCount(
              { found: clips.length, shown: shown.length, selected: selected.length },
              t,
            )}{' '}
            {/* A sweep ends with nothing checked, and every export stays
                dead until something is: the blanket check needs a target
                wider than the head checkbox, and it belongs on the line
                that gives the count it acts on. */}
            <button type="button" className="link" onClick={checkAll} disabled={shown.length === 0}>
              {t(allChecked ? 'results.deselectAll' : 'results.selectAll')}
            </button>
          </p>
        )}

        {/* One readout at a time: the same clips shown twice would cost two
            virtualisers and a page twice as long, the selection being shared
            anyway. */}
        {view === 'list' ? (
          <ClipTable
            clips={shown}
            selected={selectedIds}
            onToggle={toggleClip}
            onToggleAll={checkAll}
            onPlay={setPlayingId}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
            sort={sort}
            onSortChange={changeSort}
          />
        ) : (
          <ClipGrid
            clips={shown}
            dense={view === 'dense'}
            gameLabel={gameLabel}
            selected={selectedIds}
            onToggle={toggleClip}
            onPlay={setPlayingId}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
            sort={sort}
            onSortChange={changeSort}
          />
        )}

        <SelectionBar
          selected={selected}
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
            download(`${stamp}_urls.txt`, selected.map((clip) => clip.url).join('\n'), 'text/plain')
          }
        />
      </main>

      <Colophon />

      {/* Last of the page, and it does not matter where: `showModal` lifts it
          into the top layer, above everything, whatever the DOM order says. */}
      <ClipPlayer
        clips={shown}
        playingId={playingId}
        onPlayingIdChange={setPlayingId}
        selected={selectedIds}
        onToggle={toggleClip}
      />
    </div>
  )
}
