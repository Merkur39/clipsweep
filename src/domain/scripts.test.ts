import { describe, expect, it } from 'vitest'

import { buildDownloadScript, detectScriptFlavor } from './scripts'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

const URLS = [
  'https://www.twitch.tv/testchannel/clip/SpotlessVenomousPterodactylMikeHogu-RzvnjSqiUhzTIIdE',
  'https://clips.twitch.tv/SpicyLittleDragonSSSsss-L5iMcsYB7AxMN_Vt',
]

const bat = (urls = URLS, channel = 'testchannel') => buildDownloadScript('bat', channel, urls, t)
const sh = (urls = URLS, channel = 'testchannel') => buildDownloadScript('sh', channel, urls, t)

describe('detectScriptFlavor', () => {
  const ua = (userAgent: string, platform?: string) => detectScriptFlavor({ userAgent, platform })

  it('trusts userAgentData when it is available', () => {
    expect(ua('', 'Windows')).toBe('bat')
    expect(ua('', 'macOS')).toBe('sh')
    expect(ua('', 'Linux')).toBe('sh')
  })

  it('prefers userAgentData over the userAgent string', () => {
    expect(ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Linux')).toBe('sh')
  })

  it('falls back to the userAgent string', () => {
    expect(ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/141.0')).toBe('bat')
    expect(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1')).toBe('sh')
    expect(ua('Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0')).toBe('sh')
  })

  it('gives up on mobile, where neither script launches', () => {
    expect(ua('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0')).toBeNull()
    expect(ua('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)')).toBeNull()
    expect(ua('Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X)')).toBeNull()
    expect(ua('', 'Android')).toBeNull()
  })

  it('gives up rather than guessing on an unknown agent', () => {
    expect(ua('')).toBeNull()
    expect(ua('something strange')).toBeNull()
  })
})

describe('buildDownloadScript, whichever flavor', () => {
  it('carries every clip URL', () => {
    for (const script of [bat(), sh()]) {
      for (const url of URLS) expect(script).toContain(url)
    }
  })

  it('names the output folder and the archive after the channel', () => {
    for (const script of [bat(), sh()]) {
      expect(script).toContain('clips_testchannel')
      expect(script).toContain('archive.txt')
    }
  })

  it('sanitizes a channel name unfit for a folder name', () => {
    for (const script of [bat(URLS, 'ka li/yami..'), sh(URLS, 'ka li/yami..')]) {
      expect(script).toContain('clips_ka_li_yami__')
      expect(script).not.toContain('ka li/yami')
    }
  })

  it('picks up where it stopped rather than downloading everything again', () => {
    for (const script of [bat(), sh()]) {
      expect(script).toContain('--download-archive')
      expect(script).toContain('--no-overwrites')
    }
  })

  it('asks for confirmation before fetching yt-dlp', () => {
    expect(bat()).toMatch(/set \/p .*\[O\/N\]/)
    expect(sh()).toMatch(/read -r -p .*\[O\/N\]/)
    for (const script of [bat(), sh()]) {
      expect(script).toContain('github.com/yt-dlp/yt-dlp/releases/latest/download')
    }
  })

  /**
   * The confirmation letter follows the prompt's language — "O" for oui, "Y" for
   * yes — but the script accepts both whatever happens: someone answering by
   * reflex in the other language must not see their download abandoned for no
   * readable reason.
   */
  it('accepts confirmation in either language', () => {
    const english = buildDownloadScript('bat', 'testchannel', URLS, makeT('en'))

    expect(english).toMatch(/read|set \/p/)
    expect(english).toContain('[Y/N]')
    for (const letter of ['"O"', '"Y"']) expect(english).toContain(letter)
    expect(buildDownloadScript('sh', 'testchannel', URLS, makeT('en'))).toContain('[oOyY]')
  })
})

// A yt-dlp left on disk will never be updated by the visitor, and will end up
// unable to download at all. The one the script fetches is therefore disposable:
// outside the user's folder, and erased on the way out.
describe('buildDownloadScript, disposable yt-dlp', () => {
  it('fetches yt-dlp into the temporary folder, not next to the script', () => {
    expect(bat()).toMatch(/curl .*-o "%GETCLIP_TEMP_YTDLP%"/)
    expect(bat()).toContain('set "GETCLIP_TEMP_YTDLP=%TEMP%\\')
    expect(sh()).toMatch(/curl .*-o "\$YTDLP"/)
    expect(sh()).toContain('YTDLP_TMPDIR="$(mktemp -d)"')
  })

  it('erases the yt-dlp it downloaded', () => {
    expect(bat()).toContain('del "%GETCLIP_TEMP_YTDLP%"')
    expect(sh()).toContain('rm -rf "$YTDLP_TMPDIR"')
  })

  // The case that rules out a bare `del yt-dlp.exe`: the visitor may have
  // installed it through brew or pip, or dropped it next to the script.
  it('leaves alone a yt-dlp the visitor installed', () => {
    expect(bat()).not.toMatch(/del\s+"?yt-dlp\.exe/)
    expect(sh()).not.toMatch(/rm\s+(?:-\S+\s+)*"?\.?\/?yt-dlp"?\s*$/m)
  })

  // A half-written binary, or an interrupted sweep, must not leave behind the
  // stale file all of this is trying to avoid.
  it('cleans up when things go wrong too', () => {
    // .bat: a failed download erases its own trace before exiting.
    expect(bat()).toMatch(/if errorlevel 1 \([\s\S]*del "%GETCLIP_TEMP_YTDLP%"[\s\S]*exit \/b 1/)
    // .sh: a single cleanup, armed before any download.
    expect(sh()).toContain('trap cleanup EXIT INT TERM')
    expect(sh().indexOf('trap cleanup')).toBeLessThan(sh().indexOf('curl'))
  })

  it('runs only the yt-dlp it resolved', () => {
    expect(bat()).toMatch(/"%YTDLP%" -a /)
    expect(sh()).toMatch(/"\$YTDLP" -a /)
  })
})

describe('buildDownloadScript, command injection', () => {
  // URLs come from the API, but they end up inside code executed on the user's
  // machine: anything that is not a clip URL is dropped.
  const HOSTILE = [
    'https://www.twitch.tv/a/clip/ok & del /f /s /q C:\\',
    'https://www.twitch.tv/a/clip/ok; rm -rf ~',
    'https://www.twitch.tv/a/clip/ok`whoami`',
    'https://www.twitch.tv/a/clip/ok$(id)',
    'https://www.twitch.tv/a/clip/ok\nshutdown /s',
    'https://evil.example.com/payload',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'http://www.twitch.tv/a/clip/ok',
  ]

  it('drops any input that is not a Twitch clip URL', () => {
    for (const hostile of HOSTILE) {
      for (const script of [bat([hostile]), sh([hostile])]) {
        // The payload, not the command: the script legitimately removes yt-dlp's
        // temporary folder with an `rm -rf`, and it is the `~` target that would
        // signal the injection.
        expect(script).not.toContain('del /f')
        expect(script).not.toContain('rm -rf ~')
        expect(script).not.toContain('shutdown')
        expect(script).not.toContain('whoami')
        expect(script).not.toContain('$(id)')
        expect(script).not.toContain('evil.example.com')
        expect(script).not.toContain('javascript:')
        expect(script).not.toContain('/etc/passwd')
      }
    }
  })

  it('keeps the legitimate URLs sitting next to hostile ones', () => {
    const script = sh([HOSTILE[0], URLS[0]])

    expect(script).toContain(URLS[0])
    expect(script).not.toContain('del /f')
  })

  // The net that depends on no list of patterns: no dropped input must show up
  // in the script, in any shape whatsoever.
  it('lets no hostile input through, not even partially', () => {
    for (const hostile of HOSTILE) {
      for (const script of [bat([hostile]), sh([hostile])]) {
        expect(script).not.toContain(hostile)
        // The part after the plausible URL: that is what carries the payload.
        const payload = hostile.replace(/^https?:\/\/[^\s;&`$]*/, '').trim()
        if (payload) expect(script).not.toContain(payload)
      }
    }
  })

  it('never injects a hostile channel name', () => {
    const script = bat(URLS, 'a & del /f /s /q C:\\')

    expect(script).not.toContain('del /f')
  })
})

describe('buildDownloadScript, .bat specifics', () => {
  it('doubles the % so the yt-dlp template survives the interpreter', () => {
    const script = bat()

    expect(script).toContain('%%(title)s [%%(id)s].%%(ext)s')
    // a single % before a parenthesis would be eaten by cmd
    expect(script).not.toMatch(/[^%]%\(/)
  })

  it('lays down the expected header and keeps the window open at the end', () => {
    const script = bat()

    expect(script.startsWith('@echo off')).toBe(true)
    expect(script).toContain('chcp 65001')
    expect(script).toContain('cd /d "%~dp0"')
    expect(script.trimEnd().endsWith('pause')).toBe(true)
  })

  it('uses CRLF line endings', () => {
    const script = bat()

    expect(script).toContain('\r\n')
    expect(script).not.toMatch(/[^\r]\n/)
  })

  it('stays ASCII, accents rendering at the mercy of the code page', () => {
    expect(bat()).toMatch(/^[\x20-\x7E\r\n\t]*$/)
  })
})

describe('buildDownloadScript, .sh specifics', () => {
  it('lays down the shebang and a strict mode', () => {
    const script = sh()

    expect(script.startsWith('#!/usr/bin/env bash')).toBe(true)
    expect(script).toContain('set -euo pipefail')
  })

  it('writes the list through a heredoc shielded from any expansion', () => {
    expect(sh()).toContain("<<'URLS'")
  })

  it('uses LF line endings', () => {
    expect(sh()).not.toContain('\r')
  })
})
