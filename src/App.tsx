import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Account } from './components/Account'
import { BackToTop } from './components/BackToTop'
import { ClipGrid } from './components/ClipGrid'
import { Door } from './components/Door'
import { ClipPlayer } from './components/ClipPlayer'
import { ClipTable } from './components/ClipTable'
import { Footer } from './components/Footer'
import { FiltersBar } from './components/FiltersBar'
import { SearchChip } from './components/SearchChip'
import { SearchPanel } from './components/SearchPanel'
import { SelectionBar } from './components/SelectionBar'
import { SortChip } from './components/SortChip'
import { Mark } from './components/Icon'
import { LocaleToggle } from './components/LocaleToggle'
import { SearchRun } from './components/SearchRun'
import { TicketSummary } from './components/TicketSummary'
import { TechnicalDetails } from './components/TechnicalDetails'
import { gameLabeller } from './components/selectionLabel'
import { ThemeToggle } from './components/ThemeToggle'
import { ViewToggle } from './components/ViewToggle'
import { toCsv } from './domain/csv'
import { applyTheme, parseTheme } from './domain/theme'
import { isTileView, parseView, VIEWS } from './domain/view'
import { describeAccess } from './domain/access'
import {
  applyFilters,
  dateExtent,
  facets,
  narrowedRange,
  panelOrder,
  parseThreshold,
} from './domain/filters'
import { clampSince, clampUntil, daysBefore, describePeriodError, utcDay } from './domain/period'
import { commandShortcut, isApplePlatform } from './domain/keys'
import { describeEmptyResults } from './domain/results'
import {
  buildDownloadScript,
  detectScriptFlavor,
  scriptFileName,
  type ScriptFlavor,
} from './domain/scripts'
import { selectedClips, toggle, toggleAll } from './domain/selection'
import { DEFAULT_SORT, nextSort, sortClips, type ClipSort, type SortKey } from './domain/sort'
import { useTranslation } from './i18n/LocaleProvider'
import { useChannelLookup } from './hooks/useChannelLookup'
import { useHotkey } from './hooks/useHotkey'
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

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
   * just refused, a search started too early.
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
  /* A confirmed session outranks any notice: it is what makes them stale.

     It says that it holds, and no longer for how long. A Twitch token lasts two
     months and renews itself on the next connection: a countdown from sixty days
     is a number nobody can act on, sitting in the one line of the plate that has
     to be read at a glance. What the day it runs out costs is one click, and the
     screen that asks for it says so then. */
  const authMessage = session ? t('access.connected') : (notice && t(notice.key)) || access.message
  const authKind: AccessKind = session ? 'ok' : (notice?.kind ?? access.kind)

  // Already set on `<html>` by `main.tsx` before the first render; the effect
  // only serves the changes that follow.
  const [storedTheme, setTheme] = usePersistedState('theme', 'system')
  const theme = parseTheme(storedTheme)
  useEffect(() => applyTheme(document.documentElement, theme), [theme])

  // Which readout is on screen. A display preference, like the theme, and it
  // outlives the tab for the same reason: it says how one likes to read the
  // clips, not which clips were being read.
  const [storedView, setView] = usePersistedState('view', 'table')
  const view = parseView(storedView)

  // The target and the period live for the tab's lifetime, unlike the theme:
  // they are the parameters of a search, not preferences. Finding them again
  // from one session to the next would restart, on the first click, a search
  // nobody asked for here. The channel alone can be excepted from that, one
  // tick at a time — whoever searches their own channel types the same name at
  // every opening.
  const { channel, setChannel, remember, setRemember } = useRememberedChannel()
  /**
   * The query the last search actually ran on, kept apart from the fields, or
   * null while none has run.
   *
   * The empty-table message names the channel — a channel that returned nothing
   * at all is the one empty table a typo explains. Read from the field, that
   * name would change under the reader's eyes as they typed the next one, and
   * the message would blame a channel nothing was ever asked of.
   *
   * The period is frozen here for the same reason, and it is the reopened ticket
   * that made it necessary: a period edited and then abandoned would otherwise
   * be read back off the folded ticket as the one the clips came from.
   */
  const [searched, setSearched] = useState<{
    channel: string
    since: string
    until: string
  } | null>(null)
  const searchedChannel = searched?.channel ?? ''
  /**
   * Is the ticket open on its form, or folded onto what the search found?
   *
   * It opens the session and folds on the first search, and only "edit" opens it
   * again. The four fields of a query stop changing the moment a search starts,
   * and a form left standing over the results is a form that invites a second
   * search nobody asked for — where the fold gives the whole width to the clips.
   *
   * Reopening it is a look rather than a commitment: it folds back on the way
   * out its own corner carries, without a second search having to be paid for
   * the privilege. That way out only exists once there is something to fold
   * onto — see `foldTicket`.
   */
  const [editing, setEditing] = useState(true)
  // Thirty days, not the dawn of Twitch: the default period must stay cheap, an
  // immediate click on "Search" not being allowed to commit seven yearly windows
  // before the period has been chosen. It is also the first of the three
  // shortcuts, so the ticket opens with one of them already lit.
  const [since, setSince] = usePersistedState(
    'since',
    daysBefore(utcDay(new Date()), 30),
    sessionStorage,
  )
  const [until, setUntil] = usePersistedState('until', utcDay(new Date()), sessionStorage)
  // Display filters: they bear on the clips already collected, never on the
  // search itself. Not persisted, unlike the search fields — a threshold
  // forgotten between two screens gives an unexplained empty table.
  const [minViewsInput, setMinViewsInput] = useState('')
  const [maxViewsInput, setMaxViewsInput] = useState('')
  // The display range, distinct from the period searched: narrowing it restarts
  // nothing, which is the whole point.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  // Free text over the titles: the one filter that cannot be a facet, since a
  // title is not a list of values.
  const [query, setQuery] = useState('')
  const [creators, setCreators] = useState<readonly string[]>([])
  const [gameIds, setGameIds] = useState<readonly string[]>([])
  const [sort, setSort] = useState<ClipSort>(DEFAULT_SORT)
  // Selections, not exclusions: nothing starts checked, so no export ever
  // carries a clip the user never pointed at — including the ones that appear
  // later when the threshold is raised.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  /**
   * The clip the pointer is over, in a ref rather than in state.
   *
   * Nothing on screen depends on it — the sheets already draw the hovered row
   * and the hovered tile — so putting it in state would re-render the page on
   * every row the pointer crosses, for a value only the keyboard ever reads.
   */
  const hoveredRef = useRef<string | null>(null)
  // The clip being watched, held by id: the list moves underneath — a search goes
  // on delivering, a filter can carry one off — and an index would quietly come
  // to name another clip.
  const [playingId, setPlayingId] = useState<string | null>(null)
  // Read once: the visitor's machine does not change mid-session. Two questions
  // of it, and they are not the same one — "which script runs here" tells
  // Windows from the rest, "which key says command" tells Apple from the rest.
  const [platform] = useState(() => ({
    platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform,
    userAgent: navigator.userAgent,
  }))
  const flavor = detectScriptFlavor(platform)
  const editShortcut = commandShortcut(isApplePlatform(platform), 'K')
  const onTokenRejected = useCallback(() => {
    // Drop the session, otherwise the disabled connect button traps the user.
    tokenStore.clear()
    setSession(null)
    setHasToken(false)
    setNotice({ key: 'access.tokenExpired', kind: 'bad' })
  }, [])

  const search = useClipSearch(session, onTokenRejected)
  const {
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
  } = search

  // A running search, or its results on screen, live in the application's memory
  // alone: leaving the page loses them and forces a full re-search, Helix quota
  // included.
  useUnloadGuard(running || clips.length > 0)

  // The fragment was already consumed in main.tsx; here we only confirm the
  // stored token is still live.
  useEffect(() => {
    if (!storedToken) return

    /* The optimistic bet displays the account as connected for the length of
       this request, so "Disconnect" is reachable throughout it — and the
       forgetting it does never waits on the network. Either answer would then
       speak for a token nobody holds any more: one would revive the account,
       the other would blame an expiry for a departure. The store is what the
       departure clears, so the store is what says whether this answer still has
       a subject. Unmounting is not the test — `App` never does. */
    const stillHeld = () => tokenStore.read() === storedToken

    validateToken(storedToken)
      .then((confirmed) => {
        if (stillHeld()) setSession(confirmed)
      })
      // The optimistic bet takes itself back here, and only here.
      .catch(() => {
        if (stillHeld()) onTokenRejected()
      })
  }, [storedToken, onTokenRejected])

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

  /* What is known about the name being typed. Two things read it: the period
     shortcuts, which need the creation date to resolve "since the beginning",
     and the run button, which refuses a name Twitch has answered it does not
     have. */
  const lookup = useChannelLookup(session, channel)
  const channelCreatedAt = lookup.status === 'found' ? lookup.createdAt : null
  // Derived, never written back into the state: `since` keeps the input, which
  // becomes valid again as typed if the target channel changes to an older one.
  // This is the value that displays and that goes to the search.
  const effectiveSince = clampSince(since, channelCreatedAt)
  // Recomputed on every render: a session left open past UTC midnight unlocks
  // the following day by itself.
  const today = utcDay(new Date())
  const effectiveUntil = clampUntil(until, today)
  // The bounds constrain each date separately, never their order: that is the
  // only disorder still possible.
  const periodError = describePeriodError(effectiveSince, effectiveUntil, t)

  const maxViews = parseThreshold(maxViewsInput)
  const minViews = parseThreshold(minViewsInput)
  const from = fromDate || null
  const to = toDate || null
  const shown = useMemo(
    () =>
      sortClips(
        applyFilters(clips, { minViews, maxViews, from, to, creators, gameIds, query }),
        sort,
      ),
    [clips, minViews, maxViews, from, to, creators, gameIds, query, sort],
  )
  /**
   * What each facet is counted against: every filter **but its own**.
   *
   * A facet counted on the full search promises clips another filter has already
   * ruled out. Counted on `shown`, it would erase itself instead — the creators
   * list, read off a selection of creators, would hold only those already
   * checked and no second one could ever be added. Excluding its own constraint
   * is what makes "SpiZ or Ori" survive the first click.
   */
  const creatorMatching = useMemo(
    () => applyFilters(clips, { minViews, maxViews, from, to, creators: [], gameIds, query }),
    [clips, minViews, maxViews, from, to, gameIds, query],
  )
  const gameMatching = useMemo(
    () => applyFilters(clips, { minViews, maxViews, from, to, creators, gameIds: [], query }),
    [clips, minViews, maxViews, from, to, creators, query],
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
  // grows along with the search, like the facets.
  const dateBounds = useMemo(() => dateExtent(clips), [clips])
  // The range as it actually restricts. A search sets both bounds on the period
  // it covers, so the fields are never empty afterwards: read raw, they would
  // claim every empty table for themselves and leave the threshold on views —
  // the real culprit — unnamed.
  const narrowed = useMemo(() => narrowedRange({ from, to }, dateBounds), [from, to, dateBounds])
  const gameLabel = useMemo(() => gameLabeller(gameNames, t), [gameNames, t])

  /**
   * Whether any filter is set — read from the fields, like the chips beside the
   * reset, and not from whether those fields hold anything back.
   *
   * A search fills the two date fields with the period it ran on, so the dates
   * chip is lit from then on and this is the button that clears it. Judged on
   * `narrowedRange` instead, a set filter would have had no way to be unset.
   */
  const filtersActive =
    Boolean(minViewsInput || maxViewsInput || fromDate || toDate || query) ||
    creators.length > 0 ||
    gameIds.length > 0
  const resetFilters = () => {
    setQuery('')
    setMinViewsInput('')
    setMaxViewsInput('')
    setFromDate('')
    setToDate('')
    setCreators([])
    setGameIds([])
  }
  /**
   * Both bounds at one go, which is what a period shortcut sets. Two separate
   * reports would let a render see a start without its end — and one of those
   * pairs is inconsistent for as long as it takes to apply the second.
   */
  const setPeriod = ({ since: from, until: to }: { since: string; until: string }) => {
    setSince(from)
    setUntil(to)
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
  // The ticket only ever adds; `toggleAll` on a full selection would empty it.
  const selectAll = () =>
    setSelectedIds((previous) => (allChecked ? previous : toggleAll(shown, previous)))
  const toggleClip = (id: string) => setSelectedIds((previous) => toggle(previous, id))

  /**
   * The escape hatch for a table emptied by a filter: it reopens the one the
   * message has just named, and therefore follows the same precedence — the
   * range first, since that is what the user just narrowed by hand.
   */
  const reopenFilter = () => {
    if (clips.length === 0) return null
    // Same order as the message it answers: the search is the last thing typed.
    if (query.trim() !== '') return () => setQuery('')
    if (narrowed.from !== null || narrowed.to !== null) return clearDates
    if (maxViews !== null) return () => setMaxViewsInput('')
    return null
  }
  const reopen = reopenFilter()

  // Computed once for the two readouts: they go empty for the same reasons, and
  // must say so in the same words.
  const emptyMessage = describeEmptyResults(
    {
      channel: searchedChannel,
      /* A slice has come back, which is the only thing that can support a
         verdict on the channel. Not `progress !== null`, which it used to be
         and which stopped meaning that: the slice count is now announced before
         the first request goes out, so a search stopped during its first slice
         would have this line declaring the channel empty on the strength of no
         answer whatsoever — and, on the default period of one month, that is a
         search with exactly one slice in it. */
      searched: (progress?.windowsDone ?? 0) > 0,
      running,
      clipsFound: clips.length,
      maxViews,
      period: narrowed,
      query,
    },
    t,
  )
  /**
   * What the search has found, live.
   *
   * Not `clips.length`: the clips are handed over one slice at a time — a whole
   * calendar year of them — where the pages report as they land, so between two
   * slices the table is a count that has stopped moving while the search has
   * not. Computed here rather than in either readout because *two* of them say
   * this number, in the same words, three centimetres apart — the figure the run
   * block is built around and the ticket's answer line above it — and two
   * readouts of one number may not disagree.
   *
   * Deduplicated all the same, being the size of the very map the table is
   * handed, so it never overshoots what will land in it. The table's own count
   * stays the table's: how much of the find is on screen is a different
   * question, and the tally line is where it is answered.
   *
   * ⚠️ While the search is RUNNING, and only then. A search that is stopped
   * throws out of the request the abort cancelled, so the window it was inside
   * never reaches the table — and the count, which had been counting its pages,
   * stays ahead of the table for good. Left live afterwards it would print a
   * number of clips nobody can show, over an empty readout saying the channel
   * has none. Running, the two are a slice apart and converge at every
   * boundary; stopped, only the table tells the truth.
   */
  const clipsFound = running ? (progress?.clipsFound ?? clips.length) : clips.length

  const emptyAction = reopen
    ? { label: t('results.showAll', { n: clips.length }), onClick: reopen }
    : undefined
  const changeSort = (key: SortKey) => setSort((current) => nextSort(current, key))

  /**
   * Open on its form, or folded onto what the search found. A running search
   * cannot be edited: the fold is what the "stop" button hangs from.
   */
  const ticketOpen = editing && !running

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
    setEditing(false)
    // A new search starts from a blank selection and blank filters: keeping a
    // threshold from the previous search would give an unexplained empty table.
    setSelectedIds(new Set())
    resetFilters()
    // The range is the exception: it opens on the period being searched rather
    // than empty. It hides nothing — nothing outside that period will be
    // collected — and it gives the two fields a starting point to narrow from,
    // instead of a blank the user has to fill in before narrowing at all.
    setFromDate(effectiveSince)
    setToDate(effectiveUntil)
    setSearched({ channel, since: effectiveSince, until: effectiveUntil })
    void search.start({ channel, since: effectiveSince, until: effectiveUntil })
  }

  /**
   * Folding the reopened ticket back, or nothing — and nothing is what it is
   * until a search has run. Before that the ticket is the whole screen, and a
   * way out of it would be a way out of the application.
   */
  const foldTicket = searched === null ? undefined : () => setEditing(false)

  const connected = session !== null || presumedConnected

  /**
   * The wall stands for whoever arrives without a session — and only for them.
   *
   * It steps aside as soon as a search has run, whatever becomes of the session
   * afterwards: a token that expires with clips on screen must not take them
   * away. The access then has the account block on the nameplate to say what
   * happened, and the clips stay where they are, exportable.
   */
  const showDoor = !connected && searchedChannel === ''

  /**
   * The two shortcuts that act on the clip under the pointer. The id is checked
   * against what is on screen before anything happens: a filter can carry off
   * the clip the pointer last touched, and the ref would then name a clip
   * nobody can see.
   */
  const hovered = () => shown.find((clip) => clip.id === hoveredRef.current) ?? null

  /* The keyboard, such as it is: the command key reopens the ticket, and the
     three digits change the density. Each of them is drawn or named on the
     control it works — the ticket's "edit" button, the three positions of the
     readout toggle — because a shortcut filed in a help page is a shortcut
     nobody meets.

     The first goes both ways, since it is the one key drawn on the button that
     opens the ticket: a reader who has just pressed it expects it to close
     again. It only ever opens while there is nothing to fold onto. */
  useHotkey({ key: 'k', command: true }, () =>
    setEditing((open) => !(open && foldTicket !== undefined)),
  )
  useHotkey({ key: '1' }, () => setView(VIEWS[0]))
  useHotkey({ key: '2' }, () => setView(VIEWS[1]))
  useHotkey({ key: '3' }, () => setView(VIEWS[2]))
  useHotkey({ key: ' ' }, () => {
    const clip = hovered()
    if (clip) setPlayingId(clip.id)
  })
  useHotkey({ key: 'x' }, () => {
    const clip = hovered()
    if (clip) toggleClip(clip.id)
  })

  const stamp = `${channel || 'clips'}_${today}`
  /* The scripts are named apart from the data files, and it is not decoration:
     past the download there is no interface left, only a row in a folder, and
     `kaliyami_2026-08-28.bat` says nothing there about what to do with it. Built
     here, where the channel and the day are, and handed to the bar as well as to
     the download — the bar quotes the name in the command it gives a Unix
     visitor. A CSV keeps the plain stamp: its name already says what it is. */
  const scriptFiles: Record<ScriptFlavor, string> = {
    bat: scriptFileName('bat', channel, today, t),
    sh: scriptFileName('sh', channel, today, t),
  }

  return (
    <div className="page">
      {/* A nameplate, not a welcome banner: the tool is consulted every day,
          and its name has no need of 46 px. */}
      <header className="masthead">
        <h1 className="masthead-name">
          <Mark />
          ClipSweep
        </h1>
        <p className="lede">{t('app.tagline')}</p>
        {/* What holds for the whole session, filed at the end of the plate:
            two display preferences of equal standing — hence of equal shape —
            and the account, which is neither a preference nor a parameter of
            the search. It opened the ticket until the ticket learned to fold:
            an access that does not change from one search to the next has no
            business in the row that changes with each one. */}
        <div className="masthead-side">
          <div className="masthead-prefs">
            <LocaleToggle />
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>

          {/* Nothing while the wall is up: it carries the message and the
              button, and a second call to connect three centimetres above it
              would be a second call to connect. */}
          {!showDoor && (
            <Account
              message={authMessage}
              kind={authKind}
              connected={connected}
              canConnect={Boolean(BUILD_TIME_CLIENT_ID)}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          )}
        </div>
      </header>

      {showDoor ? (
        <Door
          message={authMessage}
          kind={authKind}
          canConnect={Boolean(BUILD_TIME_CLIENT_ID)}
          onConnect={connect}
        />
      ) : (
        <div className="layout">
          {ticketOpen ? (
            <SearchPanel
              channel={channel}
              onChannelChange={setChannel}
              lastChannel={searchedChannel}
              remember={remember}
              onRememberChange={setRemember}
              since={effectiveSince}
              onSinceChange={setSince}
              until={effectiveUntil}
              onUntilChange={setUntil}
              onPeriodChange={setPeriod}
              today={today}
              periodError={periodError}
              channelCreatedAt={channelCreatedAt}
              channelStatus={lookup.status}
              running={running}
              onRun={run}
              onFold={foldTicket}
            />
          ) : (
            /* Folded: what was searched, what it found, and what is wrong with
             it. It carries the heading and the counts the stage used to file
             above its toolbar. */
            <TicketSummary
              channel={searchedChannel}
              since={searched?.since ?? effectiveSince}
              until={searched?.until ?? effectiveUntil}
              clipsFound={clipsFound}
              shown={shown.length}
              selected={selected.length}
              allChecked={allChecked}
              onSelectAll={selectAll}
              incomplete={incomplete.length}
              running={running}
              editShortcut={editShortcut}
              onEdit={() => setEditing(true)}
              onStop={search.stop}
            />
          )}

          {/* Nothing until something has been searched for, and the same
              `searched` the fold hangs from: everything below acts on clips —
              an order, four filters, a density, the sortable heads of the
              readout, and the drawer onto a run's trace. Standing there empty
              they are an invitation to use a toolbar that acts on nothing, the
              very thing `SearchRun` already refuses to say out loud. The filter
              row's two date fields are the worst of it: a second period beside
              the one in the ticket, and only the ticket's goes and fetches.

              It comes out on the click rather than on the first slice, `run`
              setting `searched` before it starts anything — so the progress bar
              is there from the outset. */}
          {searched !== null && (
            <main className="stage">
              <SearchRun
                progress={progress}
                pausedUntil={pausedUntil}
                clipsFound={clipsFound}
                running={running}
                elapsedMs={elapsedMs}
              />

              {/* Over the toolbar rather than under it: it answers for the
                search, which is what has just happened above it, where the row
                below acts on what the search brought back. Reading down the page
                is then chronological — what was asked, how it went, what to do
                with it — and the drawer opening no longer pushes the controls
                away from the clips they govern. */}
              <TechnicalDetails
                reports={reports}
                span={span}
                progress={progress}
                logEntries={logEntries}
              />

              {/* One row for everything that acts on what is already found: the
                order, the four filters, the blanket reset, and how tightly it is
                all drawn. They used to sit in three places — a label, a row and a
                strip above the grid — which is three places to look for one kind
                of thing. */}
              <div className="toolbar">
                <SortChip sort={sort} onChange={changeSort} />

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

                <button
                  type="button"
                  className="link filters-reset"
                  onClick={resetFilters}
                  disabled={!filtersActive}
                >
                  {t('results.reset')}
                </button>

                {/* Apart from the four facets, and after them: a title is not a
                    list of values, so this one opens on a field rather than on a
                    catalogue — and it is the only filter with a key of its own. */}
                <SearchChip query={query} onQueryChange={setQuery} />

                <ViewToggle view={view} onChange={setView} />
              </div>

              {/* One readout at a time: the same clips shown twice would cost two
                virtualisers and a page twice as long, the selection being shared
                anyway. */}
              {!isTileView(view) ? (
                <ClipTable
                  clips={shown}
                  selected={selectedIds}
                  onToggle={toggleClip}
                  onToggleAll={checkAll}
                  onPlay={setPlayingId}
                  onHover={(id) => (hoveredRef.current = id)}
                  emptyMessage={emptyMessage}
                  emptyAction={emptyAction}
                  sort={sort}
                  onSortChange={changeSort}
                  gameLabel={gameLabel}
                />
              ) : (
                <ClipGrid
                  view={view}
                  clips={shown}
                  selected={selectedIds}
                  onToggle={toggleClip}
                  onPlay={setPlayingId}
                  onHover={(id) => (hoveredRef.current = id)}
                  emptyMessage={emptyMessage}
                  emptyAction={emptyAction}
                />
              )}
            </main>
          )}
        </div>
      )}

      {/* Outside `.layout`: it closes the page under the ticket and the stage,
          masthead answering it at the top of the page. */}
      <Footer />

      {/* The other corner of the foot of the page, and it exists only once the
          reader is far enough down for going back up to be a journey. The
          readout is one long list — a full search runs to thousands of rows —
          and until now the only way back to the ticket was to undo the scroll
          that got you away from it. */}
      <BackToTop />

      {/* Over the readout rather than under it: what can be done with what is
          picked belongs beside the ticks, not at the foot of a page the picking
          scrolled away from. It exists only while something is picked, which is
          how it says so without a line reading "none". */}
      <SelectionBar
        selected={selected.length}
        flavor={flavor}
        scriptFiles={scriptFiles}
        onClear={() => setSelectedIds(new Set())}
        onDownloadScript={(target) =>
          download(
            scriptFiles[target],
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
