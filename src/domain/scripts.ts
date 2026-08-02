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

function batScript(channel: string, urls: string[]): string {
  const folder = `clips_${slug(channel)}`
  // Messages stay ASCII: accented output depends on the console code page, and a
  // mangled prompt is worse than a plain one.
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    'cd /d "%~dp0"',
    '',
    `echo ClipSweep - ${urls.length} clip(s) de ${slug(channel)}`,
    'echo.',
    '',
    'rem Un yt-dlp que le visiteur a installe lui-meme, dans ce dossier ou dans',
    'rem le PATH, est utilise tel quel et jamais efface.',
    'set "YTDLP=yt-dlp.exe"',
    'set "GETCLIP_TEMP_YTDLP="',
    '',
    'if exist yt-dlp.exe goto :ready',
    'where yt-dlp.exe >nul 2>&1 && goto :ready',
    'echo yt-dlp.exe est introuvable dans ce dossier.',
    'set /p GETCLIP_FETCH="Le telecharger depuis GitHub ? [O/N] "',
    'if /i "%GETCLIP_FETCH%"=="O" goto :fetch',
    'echo Abandon. Placez yt-dlp.exe a cote de ce script, puis relancez.',
    'pause',
    'exit /b 1',
    '',
    ':fetch',
    'rem Dans le dossier temporaire, jamais a cote du script : le binaire est',
    'rem efface en partant, pour que la version soit toujours celle du jour.',
    'set "GETCLIP_TEMP_YTDLP=%TEMP%\\getclip-yt-dlp-%RANDOM%.exe"',
    'set "YTDLP=%GETCLIP_TEMP_YTDLP%"',
    'echo Telechargement de yt-dlp...',
    `curl -L --fail -o "%GETCLIP_TEMP_YTDLP%" ${YTDLP_RELEASE}/yt-dlp.exe`,
    'if errorlevel 1 (',
    '  echo Echec du telechargement de yt-dlp.',
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
    'rem Efface le binaire telecharge, jamais celui du visiteur : la variable',
    'rem n est posee que par la branche de telechargement.',
    'if defined GETCLIP_TEMP_YTDLP del "%GETCLIP_TEMP_YTDLP%" >nul 2>&1',
    '',
    'echo.',
    `echo Termine. Les clips sont dans le dossier ${folder}.`,
    'pause',
  ]
  return lines.join('\r\n')
}

function shScript(channel: string, urls: string[]): string {
  const folder = `clips_${slug(channel)}`
  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'cd "$(dirname "$0")"',
    '',
    `echo "ClipSweep - ${urls.length} clip(s) de ${slug(channel)}"`,
    '',
    '# Arme avant le moindre telechargement : une interruption ne doit rien',
    '# laisser derriere elle. Les deux variables sont vides tant que rien n a ete',
    '# cree, et `set -u` exige qu elles existent.',
    'LIST=""',
    'YTDLP_TMPDIR=""',
    'cleanup() {',
    '  if [ -n "$LIST" ]; then rm -f "$LIST"; fi',
    '  if [ -n "$YTDLP_TMPDIR" ]; then rm -rf "$YTDLP_TMPDIR"; fi',
    '}',
    'trap cleanup EXIT INT TERM',
    '',
    '# Un yt-dlp que le visiteur a installe lui-meme, par son gestionnaire de',
    '# paquets ou depose ici, est utilise tel quel et jamais efface.',
    'if command -v yt-dlp >/dev/null 2>&1; then',
    '  YTDLP=yt-dlp',
    'elif [ -x ./yt-dlp ]; then',
    '  YTDLP=./yt-dlp',
    'else',
    '  echo "yt-dlp est introuvable."',
    '  read -r -p "Le telecharger depuis GitHub ? [o/N] " reply',
    '  [ "$reply" = "o" ] || { echo "Abandon."; exit 1; }',
    '  # Dans un dossier temporaire, jamais a cote du script : le binaire est',
    '  # efface en partant, pour que la version soit toujours celle du jour.',
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
    `echo "Termine. Les clips sont dans le dossier ${folder}."`,
    '',
  ]
  return lines.join('\n')
}

export function buildDownloadScript(flavor: ScriptFlavor, channel: string, urls: string[]): string {
  const safe = keepClipUrls(urls)
  return flavor === 'bat' ? batScript(channel, safe) : shScript(channel, safe)
}
