export type ScriptFlavor = 'bat' | 'sh'

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
    `echo GetClipTwitch - ${urls.length} clip(s) de ${slug(channel)}`,
    'echo.',
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
    'echo Telechargement de yt-dlp...',
    `curl -L --fail -o yt-dlp.exe ${YTDLP_RELEASE}/yt-dlp.exe`,
    'if errorlevel 1 (',
    '  echo Echec du telechargement de yt-dlp.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    ':ready',
    'set "GETCLIP_LIST=%TEMP%\\getclip_urls.txt"',
    'break > "%GETCLIP_LIST%"',
    ...urls.map((url) => `>>"%GETCLIP_LIST%" echo ${url}`),
    '',
    `yt-dlp.exe -a "%GETCLIP_LIST%" -P "${folder}" -o "%%(title)s [%%(id)s].%%(ext)s" --download-archive "${folder}\\archive.txt" --no-overwrites --sleep-requests 1`,
    'del "%GETCLIP_LIST%" >nul 2>&1',
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
    `echo "GetClipTwitch - ${urls.length} clip(s) de ${slug(channel)}"`,
    '',
    'if command -v yt-dlp >/dev/null 2>&1; then',
    '  YTDLP=yt-dlp',
    'elif [ -x ./yt-dlp ]; then',
    '  YTDLP=./yt-dlp',
    'else',
    '  echo "yt-dlp est introuvable."',
    '  read -r -p "Le telecharger depuis GitHub ? [o/N] " reply',
    '  [ "$reply" = "o" ] || { echo "Abandon."; exit 1; }',
    `  curl -L --fail -o yt-dlp ${YTDLP_RELEASE}/yt-dlp`,
    '  chmod +x yt-dlp',
    '  YTDLP=./yt-dlp',
    'fi',
    '',
    'LIST="$(mktemp)"',
    'trap \'rm -f "$LIST"\' EXIT',
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
