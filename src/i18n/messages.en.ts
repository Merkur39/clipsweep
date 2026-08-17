import type { Catalogue } from './messages.fr'

/** The English translation. See `messages.fr.ts` for the writing rules. */
export const en: Catalogue = {
  // ── Masthead ─────────────────────────────────────────────────────────────
  'app.tagline': 'Every clip a channel ever had. Yes, that one too.',

  // ── Access ───────────────────────────────────────────────────────────────
  'access.disconnected': 'Disconnected from Twitch.',
  'access.connected': 'Connected.',
  'access.connectedFor': 'Connected — {life}.',
  'access.tokenExpired': 'Token expired.',
  'access.revokeFailed': 'Token forgotten here; Twitch did not confirm the revocation.',
  'access.refused': 'Twitch refused the connection: {error}',
  'access.unconfigured':
    'No application configured. Set VITE_TWITCH_CLIENT_ID in .env.local, and declare {redirectUri} in your Twitch application’s “OAuth Redirect URLs”.',
  'access.verifying': 'Checking the token, try again.',
  'access.required': 'Connect to Twitch before starting the sweep.',

  'access.life.minutes': { one: '{n} min left', other: '{n} min left' },
  'access.life.hours': { one: '{n} h left', other: '{n} h left' },
  'access.life.days': { one: '{n} d left', other: '{n} d left' },

  'session.connected': 'Connected',
  'session.disconnected': 'Disconnected',

  // ── Search panel ─────────────────────────────────────────────────────────
  'panel.access': 'Access',
  'panel.connect': 'Connect to Twitch',
  'panel.disconnect': 'Disconnect',
  'panel.target': 'Target',
  'panel.sweep': 'Sweep',
  'panel.period': 'Period',
  'panel.channel': 'Channel',
  'panel.remember': 'Remember this channel',
  'panel.since': 'From',
  'panel.until': 'Until',
  'panel.run': 'Start the sweep',
  'panel.stop': 'Stop the sweep',

  'panel.preset.30d': '30 d',
  'panel.preset.6m': '6 m',
  'panel.preset.1y': '1 y',
  'panel.preset.all': 'All time',
  'panel.presets': 'Period preset',

  'panel.thisSweep': 'This sweep',
  'panel.lastSweep': 'Last sweep',
  'panel.clipsFound': 'Clips found',
  'panel.totalViews': 'Total views',
  'panel.periodCovered': 'Period covered',
  'panel.elapsed': 'Elapsed',
  'panel.nothingYet': '—',
  'panel.verdict.complete': 'Complete — no clip missing',
  'panel.verdict.pending': '{done} of {total} periods swept',
  'panel.verdict.broken': {
    one: 'Incomplete — {n} window lost',
    other: 'Incomplete — {n} windows lost',
  },
  'panel.verdict.idle': 'No sweep started',

  // ── Period ───────────────────────────────────────────────────────────────
  'period.order': 'The start date must come before the end date.',

  // ── Sweep status ─────────────────────────────────────────────────────────
  'results.status.running': {
    one: 'Sweeping — {done}/{total} periods, {n} clip found.',
    other: 'Sweeping — {done}/{total} periods, {n} clips found.',
  },
  'results.status.done': {
    one: 'Sweep complete — {n} clip found.',
    other: 'Sweep complete — {n} clips found.',
  },

  // ── Counts ───────────────────────────────────────────────────────────────
  'results.label': 'Results',
  'results.reset': 'Reset',
  'results.selectAll': 'Select all',
  'results.deselectAll': 'Deselect all',
  'results.showAll': 'Show all {n}',
  'results.count.found': { one: '{n} clip collected', other: '{n} clips collected' },
  'results.count.shown': { one: '{n} shown', other: '{n} shown' },
  'results.count.selected': { one: '{n} selected', other: '{n} selected' },

  // ── Empty table ──────────────────────────────────────────────────────────
  'results.empty.notSearched': 'No sweep has run yet.',
  'results.empty.running': 'Sweeping — the first clips are on their way.',
  'results.empty.nothing': 'No clips in this period. Widen the date range.',
  'results.empty.outOfRange': {
    one: '{n} clip collected, none {range}. Widen the “From / To” range, or clear the fields to show everything.',
    other:
      '{n} clips collected, none {range}. Widen the “From / To” range, or clear the fields to show everything.',
  },
  'results.empty.aboveViews': {
    one: '{n} clip collected, none at {max} or fewer. Raise “Max views”, or clear the field to show everything.',
    other:
      '{n} clips collected, none at {max} or fewer. Raise “Max views”, or clear the field to show everything.',
  },
  'results.empty.filtered': {
    one: '{n} clip collected, but nothing to show.',
    other: '{n} clips collected, but nothing to show.',
  },

  'results.range.between': 'between {from} and {to}',
  'results.range.from': 'from {from} onwards',
  'results.range.to': 'up to {to}',
  'results.views': { one: '{n} view', other: '{n} views' },

  // ── Filters ──────────────────────────────────────────────────────────────
  'filters.minViews': 'Min views',
  'filters.maxViews': 'Max views',
  'filters.noThreshold': 'none',
  'filters.from': 'From',
  'filters.to': 'To',
  'filters.creators': 'Creators',
  'filters.games': 'Games',
  'filters.all': 'All',
  'filters.selectedCount': '{n} selected',
  'filters.uncheckAll': 'Uncheck all',
  'filters.unknownGame': 'Unnamed ({id})',
  'filters.clearField': 'Clear {label}',

  'filters.views': 'Views',
  'filters.range': 'Range',
  'filters.anyViews': '0 – ∞',
  'filters.anyRange': 'All',
  'filters.rangeValue': '{from} → {to}',
  'filters.facetTotal': { one: '{n} value', other: '{n} values' },
  'filters.chosen': { one: '{n} chosen', other: '{n} chosen' },
  'filters.noOptions': 'Nothing to filter yet.',
  'filters.open': 'Open the {label} filter',

  // ── Table ────────────────────────────────────────────────────────────────
  'table.views': 'Views',
  'table.date': 'Date',
  'table.title': 'Title',
  'table.creator': 'Creator',
  'table.untitledClip': 'Untitled clip',
  'table.untitled': '(untitled)',
  'table.play': 'Play {title}',

  // ── Thumbnails ───────────────────────────────────────────────────────────
  'view.label': 'Display',
  'view.table': 'Table',
  'view.grid': 'Thumbnails',
  'grid.sortBy': 'Sort',

  // ── Player ───────────────────────────────────────────────────────────────
  'player.label': 'Clip player',
  'player.close': 'Close',
  'player.previous': 'Previous clip',
  'player.next': 'Next clip',
  'player.position': '{index} / {total}',
  'player.select': 'Select',
  'player.deselect': 'Stop keeping it',
  'player.previousShort': 'Previous',
  'player.nextShort': 'Next',
  'player.openOnTwitch': 'Open on Twitch',
  'player.unavailable': 'This clip cannot be played here.',

  // ── Progress ─────────────────────────────────────────────────────────────
  'progress.incomplete': {
    one: '{n} period could not be explored in full: clips are missing from it. Narrow the date range.',
    other:
      '{n} periods could not be explored in full: clips are missing from them. Narrow the date range.',
  },
  'progress.details': 'Sweep statistics',
  'progress.detailsAside': 'time breakdown · creators · log',
  'progress.timeSplit': 'Time breakdown',
  'progress.legend.done': 'complete period',
  'progress.legend.split': 'split',
  'progress.legend.lost': 'lost',
  'progress.periods': 'Periods',
  'progress.requests': 'Requests',
  'progress.log': 'Log',
  'progress.logEmpty': 'Standing by.',

  // ── Statistics drawer ────────────────────────────────────────────────────
  'stats.toggle': 'Sweep statistics',
  'stats.hide': 'Hide',
  'stats.peekPeriods': { one: '{n} period', other: '{n} periods' },
  'stats.peekRequests': { one: '{n} request', other: '{n} requests' },
  'stats.peekSplit': { one: '{n} window split', other: '{n} windows split' },
  'stats.topCreators': 'Top creators',
  'stats.topGames': 'Top games',
  'stats.total': { one: '{n} total', other: '{n} total' },
  'stats.others': { one: '{n} other', other: '{n} others' },
  'stats.rankingEmpty': 'Nothing to rank.',
  'stats.zeroViews': 'Zero-view clips',
  'stats.windowsSplit': 'Windows split',
  'stats.friezeSub': { one: '{n} period', other: '{n} periods' },
  'stats.logSub': { one: '{n} request · full trace', other: '{n} requests · full trace' },

  // ── The floating sweep banner ────────────────────────────────────────────
  'sweep.tidy': 'Tidy away — the sweep goes on',
  'sweep.reopen': 'Bring the sweep readout back',
  'sweep.label': 'Sweep progress',
  'sweep.percent': '{n}%',
  'sweep.window': '{from} → {to}',

  // ── The connect screen ───────────────────────────────────────────────────
  'hero.badge': 'Every window, split until nothing is missing',
  'hero.titleLead': 'Every clip a channel ever had.',
  'hero.titleEm': 'Yes, that one too.',
  'hero.lede':
    'Twitch only ever hands out the thousand most-watched clips of a period. ClipSweep splits the period until each slice fits under that ceiling — then hands you the whole list.',
  'hero.fact.storage': 'Nothing stored',
  'hero.fact.storageNote': 'The token lives in your browser, revoked on disconnect.',
  'hero.fact.exports': 'Exports as you like',
  'hero.fact.exportsNote': 'CSV, JSON, a URL list, or a ready-to-run download script.',
  'hero.fact.zero': 'Zero-view clips',
  'hero.fact.zeroNote': 'The ones no listing will ever show you.',

  // ── Frieze ───────────────────────────────────────────────────────────────
  'frieze.empty': 'Each explored period will appear here, its height giving the clip count.',
  'frieze.plot': {
    one: 'Time breakdown: {n} period explored between {from} and {to}.',
    other: 'Time breakdown: {n} periods explored between {from} and {to}.',
  },
  'frieze.clips': { one: '{n} clip', other: '{n} clips' },
  'frieze.hint': {
    one: '{n} period · hover for detail · logarithmic height',
    other: '{n} periods · hover for detail · logarithmic height',
  },
  'frieze.kind.done': 'complete',
  'frieze.kind.split': 'split',
  'frieze.kind.lost': 'lost',

  // ── Export ───────────────────────────────────────────────────────────────
  'export.download.title': 'Download the videos',
  'export.download.ledeBefore': 'A script to run on your machine: it borrows',
  'export.download.ledeAfter': 'if needed, installing nothing, then downloads the clips.',
  'export.download.none': 'No clip selected',
  'export.download.some': {
    one: 'Download the clip',
    other: 'Download the {n} clips',
  },
  'export.script.bat': 'Windows script (.bat)',
  'export.script.sh': 'macOS · Linux script (.sh)',
  'export.script.batHelp': 'Save it in a folder, then double-click it.',
  'export.script.shHelp': 'Save it, then: chmod +x file.sh && ./file.sh',
  'export.script.batHint': 'Windows script (.bat) — save it in a folder, then double-click it.',
  'export.script.shHint': 'macOS · Linux script (.sh) — save it, then chmod +x and run it.',
  'export.script.otherUnix': 'I’m on macOS or Linux',
  'export.script.otherWindows': 'I’m on Windows',
  'export.list.title': 'Export the list',
  'export.list.lede':
    'The clips’ metadata, without the videos — for a spreadsheet or another tool.',
  'export.urlsHelp': 'One URL per line, for yt-dlp -a',
  'export.tally': '{selected} of {found}',
  'export.tallyFound': { one: '{n} collected', other: '{n} collected' },

  // ── Preferences ──────────────────────────────────────────────────────────
  'theme.label': 'Theme',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'locale.label': 'Language',
  'locale.auto': 'Automatic',

  // ── Colophon ─────────────────────────────────────────────────────────────
  'colophon.source': 'Source code — GPL-3.0',
  'colophon.twitchApi': 'Twitch API',
  'colophon.independent': 'Independent project, unaffiliated with Twitch Interactive, Inc.',
  'colophon.ownership':
    'Clips remain the property of their authors: what you do with them is on you.',
  'colophon.analytics': 'Anonymous analytics, no cookies.',

  // ── Sweep log ────────────────────────────────────────────────────────────
  'log.stopRequested': 'Stop requested.',
  'log.channel': 'Channel: {name} (id {id}), created on {date}.',
  'log.beforeCreation': 'The channel predates {date}: older clips are out of scope.',
  'log.windows': {
    one: '{n} yearly window to explore, narrowed if needed.',
    other: '{n} yearly windows to explore, narrowed if needed.',
  },
  'log.windowSplit': '{indent}{from} → {to} saturated ({n}), split in two',
  'log.windowLost':
    '{indent}{from} → {to}: {n} clips — still saturated at the floor, clips are missing',
  'log.window': '{indent}{from} → {to}: {n} clips',
  'log.summary': '{clips} unique clips in {requests} requests.',
  'log.interrupted': 'Sweep interrupted: the result is partial.',
  'log.gameNames': 'Some game names could not be fetched: the filter will list their ids.',
  'log.failed': 'Failed: {reason}',

  // ── Network errors ───────────────────────────────────────────────────────
  'error.tokenRejected': 'Token refused by Twitch. Reconnect.',
  'error.tokenInvalid': 'Token expired or revoked.',
  'error.helixStatus': 'Twitch answers {status}',
  'error.attemptsExhausted': 'Attempts exhausted on /{path}: {n}.',
  'error.channelNotFound': 'Channel “{login}” not found.',

  // ── Generated scripts (ASCII only) ───────────────────────────────────────
  'script.header': 'ClipSweep - {count} clip(s) from {channel}',
  'script.missingBat': 'yt-dlp.exe was not found in this folder.',
  'script.missingSh': 'yt-dlp was not found.',
  'script.askFetch': 'Download it from GitHub? [Y/N]',
  'script.abortBat': 'Aborted. Put yt-dlp.exe next to this script, then run it again.',
  'script.abortSh': 'Aborted.',
  'script.fetching': 'Downloading yt-dlp...',
  'script.fetchFailed': 'Failed to download yt-dlp.',
  'script.done': 'Done. The clips are in the {folder} folder.',
}
