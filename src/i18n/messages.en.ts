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
  'access.refused': 'Twitch refused the connection: {error}',
  'access.unconfigured':
    'No application configured. Set VITE_TWITCH_CLIENT_ID in .env.local, and declare {redirectUri} in your Twitch application’s “OAuth Redirect URLs”.',
  'access.verifying': 'Checking the token, try again.',
  'access.required': 'Connect to Twitch before starting the sweep.',

  'access.life.minutes': { one: '{n} min left', other: '{n} min left' },
  'access.life.hours': { one: '{n} h left', other: '{n} h left' },
  'access.life.days': { one: '{n} d left', other: '{n} d left' },

  // ── Search panel ─────────────────────────────────────────────────────────
  'panel.access': 'Access',
  'panel.connect': 'Connect to Twitch',
  'panel.disconnect': 'Disconnect',
  'panel.target': 'Target',
  'panel.channel': 'Channel',
  'panel.since': 'From',
  'panel.until': 'Until',
  'panel.backToCreation': 'Back to channel creation ({date})',
  'panel.run': 'Start the sweep',
  'panel.stop': 'Stop the sweep',

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
  'filters.clearField': 'Clear {label}',

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
  'player.deselect': 'Remove',
  'player.openOnTwitch': 'Open on Twitch',
  'player.unavailable': 'This clip cannot be played here.',

  // ── Progress ─────────────────────────────────────────────────────────────
  'progress.incomplete': {
    one: '{n} period could not be explored in full: clips are missing from it. Narrow the date range.',
    other:
      '{n} periods could not be explored in full: clips are missing from them. Narrow the date range.',
  },
  'progress.details': 'Sweep details',
  'progress.detailsAside': 'frieze, counters, log',
  'progress.timeSplit': 'Time breakdown',
  'progress.legend.done': 'complete period',
  'progress.legend.split': 'saturated, split',
  'progress.legend.lost': 'saturated at the floor — clips missing',
  'progress.periods': 'Periods',
  'progress.requests': 'Requests',
  'progress.log': 'Log',
  'progress.logEmpty': 'Standing by.',

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
  'frieze.kind.split': 'saturated, split',
  'frieze.kind.lost': 'saturated at the floor — clips missing',

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
  'log.gameNames': 'Game names unavailable: the filter will list ids.',
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
