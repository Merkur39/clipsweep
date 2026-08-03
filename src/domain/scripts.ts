import type { T } from '../i18n/translate'

export type ScriptFlavor = 'bat' | 'sh'

export interface PlatformHints {
  /** `navigator.userAgentData.platform`, when the browser exposes it. */
  platform?: string
  userAgent: string
}

/**
 * Which script the visitor can actually run, or null when we cannot tell —
 * including on mobile, where neither one launches. Null means "show both and
 * let them choose" rather than "guess".
 */
export function detectScriptFlavor({ platform, userAgent }: PlatformHints): ScriptFlavor | null {
  const hint = platform?.trim()
  if (hint) {
    if (/^windows/i.test(hint)) return 'bat'
    if (/^(macos|linux)$/i.test(hint)) return 'sh'
    return null
  }

  // Mobile first: an Android UA also says "Linux", an iPad one says "Mac OS X".
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return null
  if (/Windows NT/i.test(userAgent)) return 'bat'
  if (/Macintosh|Mac OS X|X11|Linux/i.test(userAgent)) return 'sh'
  return null
}

const YTDLP_RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'

/**
 * Twitch clip URLs, and nothing else. These strings end up inside a script the
 * user executes, so anything that is not provably a clip URL is dropped rather
 * than escaped — an allowlist has no bypass to reason about.
 */
const CLIP_URL =
  /^https:\/\/(?:www\.twitch\.tv\/[A-Za-z0-9_]{1,64}\/clip\/[A-Za-z0-9_-]{1,128}|clips\.twitch\.tv\/[A-Za-z0-9_-]{1,128})$/

function keepClipUrls(urls: string[]): string[] {
  return urls.filter((url) => CLIP_URL.test(url))
}

/** Folder-safe, and safe to interpolate into a shell script. */
function slug(channel: string): string {
  return channel.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'clips'
}

function batScript(channel: string, urls: string[], t: T): string {
  const folder = `clips_${slug(channel)}`
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    'cd /d "%~dp0"',
    '',
    `echo ${t('script.header', { count: String(urls.length), channel: slug(channel) })}`,
    'echo.',
    '',
    'rem A yt-dlp the visitor installed themselves, in this folder or on the',
    'rem PATH, is used as-is and never erased.',
    'set "YTDLP=yt-dlp.exe"',
    'set "GETCLIP_TEMP_YTDLP="',
    '',
    'if exist yt-dlp.exe goto :ready',
    'where yt-dlp.exe >nul 2>&1 && goto :ready',
    `echo ${t('script.missingBat')}`,
    `set /p GETCLIP_FETCH="${t('script.askFetch')} "`,
    // Both letters are accepted whatever language asked: someone answering "Y"
    // to a French prompt must not be turned away.
    'if /i "%GETCLIP_FETCH%"=="O" goto :fetch',
    'if /i "%GETCLIP_FETCH%"=="Y" goto :fetch',
    `echo ${t('script.abortBat')}`,
    'pause',
    'exit /b 1',
    '',
    ':fetch',
    'rem Into the temporary folder, never next to the script: the binary is',
    'rem erased on the way out, so the version is always the current one.',
    'set "GETCLIP_TEMP_YTDLP=%TEMP%\\getclip-yt-dlp-%RANDOM%.exe"',
    'set "YTDLP=%GETCLIP_TEMP_YTDLP%"',
    `echo ${t('script.fetching')}`,
    `curl -L --fail -o "%GETCLIP_TEMP_YTDLP%" ${YTDLP_RELEASE}/yt-dlp.exe`,
    'if errorlevel 1 (',
    `  echo ${t('script.fetchFailed')}`,
    '  del "%GETCLIP_TEMP_YTDLP%" >nul 2>&1',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    ':ready',
    'set "GETCLIP_LIST=%TEMP%\\getclip_urls.txt"',
    'break > "%GETCLIP_LIST%"',
    ...urls.map((url) => `>>"%GETCLIP_LIST%" echo ${url}`),
    '',
    `"%YTDLP%" -a "%GETCLIP_LIST%" -P "${folder}" -o "%%(title)s [%%(id)s].%%(ext)s" --download-archive "${folder}\\archive.txt" --no-overwrites --sleep-requests 1`,
    'del "%GETCLIP_LIST%" >nul 2>&1',
    'rem Erases the downloaded binary, never the visitor s own: the variable',
    'rem is only set by the download branch.',
    'if defined GETCLIP_TEMP_YTDLP del "%GETCLIP_TEMP_YTDLP%" >nul 2>&1',
    '',
    'echo.',
    `echo ${t('script.done', { folder })}`,
    'pause',
  ]
  return lines.join('\r\n')
}

function shScript(channel: string, urls: string[], t: T): string {
  const folder = `clips_${slug(channel)}`
  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'cd "$(dirname "$0")"',
    '',
    `echo "${t('script.header', { count: String(urls.length), channel: slug(channel) })}"`,
    '',
    '# Armed before any download: an interruption must leave nothing behind.',
    '# Both variables stay empty until something has been created, and `set -u`',
    '# requires them to exist.',
    'LIST=""',
    'YTDLP_TMPDIR=""',
    'cleanup() {',
    '  if [ -n "$LIST" ]; then rm -f "$LIST"; fi',
    '  if [ -n "$YTDLP_TMPDIR" ]; then rm -rf "$YTDLP_TMPDIR"; fi',
    '}',
    'trap cleanup EXIT INT TERM',
    '',
    '# A yt-dlp the visitor installed themselves, through their package manager',
    '# or dropped here, is used as-is and never erased.',
    'if command -v yt-dlp >/dev/null 2>&1; then',
    '  YTDLP=yt-dlp',
    'elif [ -x ./yt-dlp ]; then',
    '  YTDLP=./yt-dlp',
    'else',
    `  echo "${t('script.missingSh')}"`,
    `  read -r -p "${t('script.askFetch')} " reply`,
    // Both letters are accepted whatever language asked.
    `  case "$reply" in [oOyY]) ;; *) echo "${t('script.abortSh')}"; exit 1 ;; esac`,
    '  # Into a temporary folder, never next to the script: the binary is',
    '  # erased on the way out, so the version is always the current one.',
    '  YTDLP_TMPDIR="$(mktemp -d)"',
    '  YTDLP="$YTDLP_TMPDIR/yt-dlp"',
    `  curl -L --fail -o "$YTDLP" ${YTDLP_RELEASE}/yt-dlp`,
    '  chmod +x "$YTDLP"',
    'fi',
    '',
    'LIST="$(mktemp)"',
    '',
    // Quoted heredoc: the shell performs no expansion on the URLs.
    'cat > "$LIST" <<\'URLS\'',
    ...urls,
    'URLS',
    '',
    `"$YTDLP" -a "$LIST" -P "${folder}" -o "%(title)s [%(id)s].%(ext)s" --download-archive "${folder}/archive.txt" --no-overwrites --sleep-requests 1`,
    '',
    `echo "${t('script.done', { folder })}"`,
    '',
  ]
  return lines.join('\n')
}

/**
 * The script's messages follow the interface language, but stay ASCII: the
 * console's code page is not guaranteed, and an accent comes out as garbage
 * there. A test checks this across every `script.` key.
 */
export function buildDownloadScript(
  flavor: ScriptFlavor,
  channel: string,
  urls: string[],
  t: T,
): string {
  const safe = keepClipUrls(urls)
  return flavor === 'bat' ? batScript(channel, safe, t) : shScript(channel, safe, t)
}
