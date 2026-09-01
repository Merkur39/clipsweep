import type { Catalogue } from './messages.fr'

/** The English translation. See `messages.fr.ts` for the writing rules. */
export const en: Catalogue = {
  // ── Masthead ─────────────────────────────────────────────────────────────
  'app.tagline': 'Find every clip, simply and quickly.',

  // ── Access ───────────────────────────────────────────────────────────────
  // The two states are labels on a lamp, not sentences: no full stop. What
  // follows them is, and keeps its own.
  'access.disconnected': 'Disconnected from Twitch',
  'access.connected': 'Connected',
  'access.tokenExpired': 'Your Twitch session has expired. Sign in again to start a new search.',
  'access.revokeFailed':
    'Signed out here, but Twitch did not confirm. To remove the access on their side: Settings → Connections.',
  'access.refused': 'Twitch refused the connection: {error}',
  'access.unconfigured':
    'No application configured. Set VITE_TWITCH_CLIENT_ID in .env.local, and declare {redirectUri} in your Twitch application’s “OAuth Redirect URLs”.',
  'access.verifying': 'Checking the token, try again.',
  'access.required': 'Connect to Twitch to start a search.',

  // ── Search panel ─────────────────────────────────────────────────────────
  // ── The door ─────────────────────────────────────────────────────────────
  'door.title': 'Every clip a channel ever had.',
  'door.titleEm': 'No limit.',
  /* The `\n` is honoured — `.door-lede` and `.door-why` carry
     `white-space: pre-line` — and it is placed for English, not carried over
     from French: the two sentences do not come out the same length. */
  'door.lede':
    'A channel, a period, and you get the full list of its clips.\nThe moments people still quote, and all the ones long forgotten.',
  'door.whyTitle': 'Why connect?',
  'door.why':
    'Twitch caps the number of requests per account.\nConnecting means the search spends your own quota.',
  'door.guarantee.permissions': 'No permission requested',
  'door.guarantee.privacy': 'No personal information',

  'panel.access': 'Access',
  'panel.connect': 'Connect with Twitch',
  'panel.disconnect': 'Disconnect',
  'panel.target': 'Target',
  'panel.channel': 'Channel',
  'panel.remember': 'Remember this channel',
  'panel.channelPlaceholder': 'channel name',
  'panel.channelUnknown': 'No channel by that name.',
  'panel.lastChannel': 'Last channel searched',
  'panel.period': 'Period',
  'panel.preset.month': 'Last 30 days',
  'panel.preset.year': 'Last 12 months',
  'panel.preset.all': 'Since the beginning',
  'panel.since': 'From',
  'panel.until': 'Until',
  'panel.dateRange': 'from {from} to {to}',
  'panel.editDates': 'Edit the dates',
  'panel.edit': 'Edit',
  'panel.fold': 'Back to the results',
  'panel.run': 'Search for clips',
  'panel.stop': 'Stop the search',

  // ── What to expect ───────────────────────────────────────────────────────

  // ── Period ───────────────────────────────────────────────────────────────
  'period.order': 'The end date is before the start date. Swap the two.',

  // ── Search status ────────────────────────────────────────────────────────
  'run.found': { one: 'clip found', other: 'clips found' },
  'run.say': 'Searching…',
  'run.slices': { one: '{n} slice of {total}', other: '{n} slices of {total}' },
  'run.eta.minutes': { one: 'about {n} min left', other: 'about {n} min left' },
  'run.eta.soon': 'less than a minute left',
  'run.paused': {
    one: 'Twitch is asking for a {n} second pause. The search resumes on its own.',
    other: 'Twitch is asking for a {n} second pause. The search resumes on its own.',
  },

  // ── Counts ───────────────────────────────────────────────────────────────
  'results.reset': 'Reset',
  'results.selectAll': 'Select all',
  'results.deselectAll': 'Deselect all',
  'results.showAll': 'Show all {n}',
  'selection.label': 'Selection',
  'selection.count': { one: '{n} clip selected', other: '{n} clips selected' },
  'results.count.found': { one: '{n} clip found', other: '{n} clips found' },
  'results.count.shown': { one: '{n} shown', other: '{n} shown' },
  'results.count.selected': { one: '{n} selected', other: '{n} selected' },
  'results.verdict.incomplete': {
    one: 'Clips are missing on {n} slice — see the technical details.',
    other: 'Clips are missing on {n} slices — see the technical details.',
  },

  // ── Empty table ──────────────────────────────────────────────────────────
  'results.empty.notSearched': 'Pick a channel and start the search.',
  'results.empty.running': 'Searching — the first clips are on their way.',
  'results.empty.nothing': '{channel} has no clips between these two dates. Try a wider period.',
  'results.empty.outOfRange': {
    one: '{n} clip found, none {range}. Widen the dates, or clear them.',
    other: '{n} clips found, none {range}. Widen the dates, or clear them.',
  },
  'results.empty.query': {
    one: 'No title contains “{query}”. Of the {n} clip found, none matches.',
    other: 'No title contains “{query}”. Of the {n} clips found, none matches.',
  },
  'results.empty.aboveViews': {
    one: 'No clip at {max} or fewer. Of the {n} found, none passes this filter.',
    other: 'No clip at {max} or fewer. Of the {n} found, none passes this filter.',
  },
  'results.empty.filtered': {
    one: '{n} clip found, but nothing to show.',
    other: '{n} clips found, but nothing to show.',
  },

  'results.range.between': 'between {from} and {to}',
  'results.range.from': 'from {from} onwards',
  'results.range.to': 'up to {to}',
  'results.views': { one: '{n} view', other: '{n} views' },

  // ── Filters ──────────────────────────────────────────────────────────────
  'filters.label': 'Filters',
  'filters.compact': 'Filter',
  'filters.views': 'Views',
  'filters.dates': 'Dates',
  'filters.minViews': 'Min views',
  'filters.maxViews': 'Max views',
  'filters.noThreshold': 'none',
  'filters.from': 'From',
  'filters.to': 'To',
  'filters.creators': 'Creators',
  'filters.search': 'Search',
  'filters.searchTitle': 'In the titles',
  'filters.games': 'Games',
  'filters.selectedCount': '{n} selected',
  'filters.uncheckAll': 'Uncheck all',
  'filters.unknownGame': 'Unnamed ({id})',
  'filters.clearField': 'Clear {label}',

  // ── Table ────────────────────────────────────────────────────────────────
  'table.views': 'Views',
  'table.date': 'Date',
  'table.title': 'Title',
  'table.creator': 'Creator',
  'table.game': 'Game',
  'table.duration': 'Length',
  'table.untitledClip': 'Untitled clip',
  'table.untitled': '(untitled)',
  'table.play': 'Play {title}',
  'table.playHint': 'Play (Space)',
  'table.pickHint': 'Select (X)',

  // ── Thumbnails ───────────────────────────────────────────────────────────
  'sort.label': 'Sort',
  'view.label': 'Display',
  'shortcut.on': '{label} ({key})',
  'view.large': 'Large thumbnails',
  'view.grid': 'Tight thumbnails',
  'view.table': 'Table',

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
  'progress.details': 'Technical details',
  'progress.detailsAside': 'timeline and log',
  'progress.resume.slices': { one: '{n} slice', other: '{n} slices' },
  'progress.resume.split': { one: '{n} halved and run again', other: '{n} halved and run again' },
  'progress.resume.requests': { one: '{n} request', other: '{n} requests' },
  'progress.legend.done': 'complete slice',
  'progress.legend.split': 'saturated, split',
  'progress.legend.lost': 'saturated at the floor — clips missing',
  'progress.logEmpty': 'Standing by.',

  // ── Timeline ───────────────────────────────────────────────────────────────
  'timeline.empty': 'Each time slice explored will appear here.',
  'timeline.plot': {
    one: 'Time breakdown: {n} slice explored between {from} and {to}.',
    other: 'Time breakdown: {n} slices explored between {from} and {to}.',
  },
  'timeline.clips': { one: '{n} clip', other: '{n} clips' },
  'timeline.hint': {
    one: '{n} slice · hover for detail · logarithmic height',
    other: '{n} slices · hover for detail · logarithmic height',
  },
  'timeline.kind.done': 'complete',
  'timeline.kind.split': 'saturated, split',
  'timeline.kind.lost': 'saturated at the floor — clips missing',

  // ── Export ───────────────────────────────────────────────────────────────
  'export.download.action': 'Download',
  'export.download.help':
    'A script to run on your machine: it fetches yt-dlp if needed, installing nothing, then downloads the clips.',
  'export.menu': 'Export',
  'export.list.help': 'The clips’ metadata, without the videos.',
  'export.script.bat': 'Windows script (.bat)',
  'export.script.sh': 'macOS · Linux script (.sh)',
  'export.script.batHelp': 'Save it in a folder, then double-click it.',
  'export.script.shHelp': 'Save it, then: chmod +x file.sh && ./file.sh',
  'export.urlsHelp': 'One URL per line, for yt-dlp -a',
  'export.handed.title': 'The script is in your downloads.',
  'export.handed.bat': 'Put it in a folder, then double-click it.',
  'export.handed.sh': 'Put it in a folder, then in a terminal: chmod +x {file} && ./{file}',
  'export.handed.close': 'Close',

  // ── Preferences ──────────────────────────────────────────────────────────
  'theme.label': 'Theme',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'locale.label': 'Language',
  'locale.auto': 'Automatic',

  // ── Footer ─────────────────────────────────────────────────────────────
  'footer.source': 'Source code — GPL-3.0-or-later',
  'footer.twitchApi': 'Twitch API',
  'footer.independent': 'Independent project, unaffiliated with Twitch Interactive, Inc.',
  'footer.ownership':
    'Clips remain the property of their authors: what you do with them is on you.',
  'footer.analytics': 'Anonymous analytics, no cookies.',

  // ── Back to top ──────────────────────────────────────────────────────────
  'toTop.label': 'Back to top',

  // ── Tip jar ──────────────────────────────────────────────────────────────
  'tipJar.label': 'Support me',

  // ── Search log ───────────────────────────────────────────────────────────
  'log.stopRequested': 'Stop requested.',
  'log.channel': 'Channel: {name} (id {id}), created on {date}.',
  'log.beforeCreation': 'The channel predates {date}: older clips are out of scope.',
  'log.slices': {
    one: '{n} yearly slice to explore, narrowed if needed.',
    other: '{n} yearly slices to explore, narrowed if needed.',
  },
  'log.sliceSplit': '{indent}{from} → {to} saturated ({n}), split in two',
  'log.sliceLost':
    '{indent}{from} → {to}: {n} clips — still saturated at the floor, clips are missing',
  'log.slice': '{indent}{from} → {to}: {n} clips',
  'log.paused': {
    one: 'Too many requests: Twitch asked for a pause of {n} second.',
    other: 'Too many requests: Twitch asked for a pause of {n} seconds.',
  },
  'log.summaryClips': { one: '{n} unique clip', other: '{n} unique clips' },
  'log.summaryRequests': { one: '{n} request', other: '{n} requests' },
  'log.interrupted': 'Search interrupted: the result is partial.',
  'log.gameNames': 'Some game names could not be obtained: the filter will list their ids.',
  'log.failed': 'Failed: {reason}',

  // ── Network errors ───────────────────────────────────────────────────────
  'error.tokenRejected': 'Token refused by Twitch. Reconnect.',
  'error.tokenInvalid': 'Token expired or revoked.',
  'error.helixStatus': 'Twitch answers {status}',
  'error.attemptsExhausted': 'Attempts exhausted on /{path}: {n}.',
  'error.channelNotFound':
    'No channel is called “{login}”. Check the spelling: it is the name that appears after twitch.tv/.',

  // ── Generated scripts (ASCII only) ───────────────────────────────────────
  'script.filename': 'download-the-clips-{channel}',
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
