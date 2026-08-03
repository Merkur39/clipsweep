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

  it('fait confiance à userAgentData quand il est disponible', () => {
    expect(ua('', 'Windows')).toBe('bat')
    expect(ua('', 'macOS')).toBe('sh')
    expect(ua('', 'Linux')).toBe('sh')
  })

  it('préfère userAgentData à la chaîne userAgent', () => {
    expect(ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Linux')).toBe('sh')
  })

  it('retombe sur la chaîne userAgent', () => {
    expect(ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/141.0')).toBe('bat')
    expect(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1')).toBe('sh')
    expect(ua('Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0')).toBe('sh')
  })

  it('renonce sur mobile, où aucun des deux scripts ne se lance', () => {
    expect(ua('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0')).toBeNull()
    expect(ua('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)')).toBeNull()
    expect(ua('Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X)')).toBeNull()
    expect(ua('', 'Android')).toBeNull()
  })

  it('renonce plutôt que de deviner sur un agent inconnu', () => {
    expect(ua('')).toBeNull()
    expect(ua('quelque chose de bizarre')).toBeNull()
  })
})

describe('buildDownloadScript, quelle que soit la variante', () => {
  it('embarque chaque URL de clip', () => {
    for (const script of [bat(), sh()]) {
      for (const url of URLS) expect(script).toContain(url)
    }
  })

  it('nomme le dossier de sortie et l’archive d’après la chaîne', () => {
    for (const script of [bat(), sh()]) {
      expect(script).toContain('clips_testchannel')
      expect(script).toContain('archive.txt')
    }
  })

  it('assainit un nom de chaîne impropre à un nom de dossier', () => {
    for (const script of [bat(URLS, 'ka li/yami..'), sh(URLS, 'ka li/yami..')]) {
      expect(script).toContain('clips_ka_li_yami__')
      expect(script).not.toContain('ka li/yami')
    }
  })

  it('reprend là où il s’est arrêté plutôt que de tout retélécharger', () => {
    for (const script of [bat(), sh()]) {
      expect(script).toContain('--download-archive')
      expect(script).toContain('--no-overwrites')
    }
  })

  it('demande confirmation avant d’aller chercher yt-dlp', () => {
    expect(bat()).toMatch(/set \/p .*\[O\/N\]/)
    expect(sh()).toMatch(/read -r -p .*\[O\/N\]/)
    for (const script of [bat(), sh()]) {
      expect(script).toContain('github.com/yt-dlp/yt-dlp/releases/latest/download')
    }
  })

  /**
   * La lettre de confirmation suit la langue de l'invite — « O » pour oui,
   * « Y » pour yes — mais le script accepte les deux quoi qu'il arrive : celui
   * qui répond par réflexe dans l'autre langue ne doit pas voir son
   * téléchargement abandonné sans raison lisible.
   */
  it('accepte la confirmation dans les deux langues', () => {
    const anglais = buildDownloadScript('bat', 'testchannel', URLS, makeT('en'))

    expect(anglais).toMatch(/read|set \/p/)
    expect(anglais).toContain('[Y/N]')
    for (const lettre of ['"O"', '"Y"']) expect(anglais).toContain(lettre)
    expect(buildDownloadScript('sh', 'testchannel', URLS, makeT('en'))).toContain('[oOyY]')
  })
})

// Un yt-dlp laissé sur le disque ne sera jamais mis à jour par le visiteur, et
// finira par ne plus savoir télécharger. Celui que le script va chercher est
// donc jetable : hors du dossier de l'utilisateur, et effacé en partant.
describe('buildDownloadScript, yt-dlp jetable', () => {
  it('va chercher yt-dlp dans le dossier temporaire, pas à côté du script', () => {
    expect(bat()).toMatch(/curl .*-o "%GETCLIP_TEMP_YTDLP%"/)
    expect(bat()).toContain('set "GETCLIP_TEMP_YTDLP=%TEMP%\\')
    expect(sh()).toMatch(/curl .*-o "\$YTDLP"/)
    expect(sh()).toContain('YTDLP_TMPDIR="$(mktemp -d)"')
  })

  it('efface le yt-dlp qu’il a téléchargé', () => {
    expect(bat()).toContain('del "%GETCLIP_TEMP_YTDLP%"')
    expect(sh()).toContain('rm -rf "$YTDLP_TMPDIR"')
  })

  // Le cas qui interdit un `del yt-dlp.exe` nu : le visiteur peut l'avoir
  // installé par brew ou pip, ou déposé lui-même à côté du script.
  it('ne touche pas à un yt-dlp que le visiteur a installé', () => {
    expect(bat()).not.toMatch(/del\s+"?yt-dlp\.exe/)
    expect(sh()).not.toMatch(/rm\s+(?:-\S+\s+)*"?\.?\/?yt-dlp"?\s*$/m)
  })

  // Un binaire à moitié écrit, ou un scan interrompu, ne doivent pas
  // laisser derrière eux le fichier périmé que tout ceci cherche à éviter.
  it('nettoie aussi quand ça tourne mal', () => {
    // .bat : le téléchargement raté efface sa propre trace avant de sortir.
    expect(bat()).toMatch(/if errorlevel 1 \([\s\S]*del "%GETCLIP_TEMP_YTDLP%"[\s\S]*exit \/b 1/)
    // .sh : un seul nettoyage, armé avant tout téléchargement.
    expect(sh()).toContain('trap cleanup EXIT INT TERM')
    expect(sh().indexOf('trap cleanup')).toBeLessThan(sh().indexOf('curl'))
  })

  it('n’exécute que le yt-dlp qu’il a résolu', () => {
    expect(bat()).toMatch(/"%YTDLP%" -a /)
    expect(sh()).toMatch(/"\$YTDLP" -a /)
  })
})

describe('buildDownloadScript, injection de commandes', () => {
  // Les URLs viennent de l’API, mais elles finissent dans du code exécuté sur la
  // machine de l’utilisateur : tout ce qui n’est pas une URL de clip est écarté.
  const HOSTILES = [
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

  it('écarte toute entrée qui n’est pas une URL de clip Twitch', () => {
    for (const hostile of HOSTILES) {
      for (const script of [bat([hostile]), sh([hostile])]) {
        // La charge, pas la commande : le script efface légitimement le dossier
        // temporaire de yt-dlp par un `rm -rf`, et c'est bien la cible `~` qui
        // signerait l'injection.
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

  it('conserve les URLs légitimes présentes à côté des hostiles', () => {
    const script = sh([HOSTILES[0], URLS[0]])

    expect(script).toContain(URLS[0])
    expect(script).not.toContain('del /f')
  })

  // Le filet qui ne dépend d'aucune liste de motifs : aucune entrée écartée ne
  // doit se retrouver dans le script, sous quelque forme que ce soit.
  it('ne laisse passer aucune entrée hostile, même partiellement', () => {
    for (const hostile of HOSTILES) {
      for (const script of [bat([hostile]), sh([hostile])]) {
        expect(script).not.toContain(hostile)
        // La partie après l'URL plausible : c'est elle qui porte la charge.
        const payload = hostile.replace(/^https?:\/\/[^\s;&`$]*/, '').trim()
        if (payload) expect(script).not.toContain(payload)
      }
    }
  })

  it('n’injecte jamais un nom de chaîne hostile', () => {
    const script = bat(URLS, 'a & del /f /s /q C:\\')

    expect(script).not.toContain('del /f')
  })
})

describe('buildDownloadScript, spécificités .bat', () => {
  it('double les % pour que le gabarit yt-dlp survive à l’interpréteur', () => {
    const script = bat()

    expect(script).toContain('%%(title)s [%%(id)s].%%(ext)s')
    // un % simple devant une parenthèse serait mangé par cmd
    expect(script).not.toMatch(/[^%]%\(/)
  })

  it('pose l’en-tête attendu et garde la fenêtre ouverte à la fin', () => {
    const script = bat()

    expect(script.startsWith('@echo off')).toBe(true)
    expect(script).toContain('chcp 65001')
    expect(script).toContain('cd /d "%~dp0"')
    expect(script.trimEnd().endsWith('pause')).toBe(true)
  })

  it('utilise des fins de ligne CRLF', () => {
    const script = bat()

    expect(script).toContain('\r\n')
    expect(script).not.toMatch(/[^\r]\n/)
  })

  it('reste en ASCII, le rendu des accents dépendant de la page de code', () => {
    expect(bat()).toMatch(/^[\x20-\x7E\r\n\t]*$/)
  })
})

describe('buildDownloadScript, spécificités .sh', () => {
  it('pose le shebang et un mode strict', () => {
    const script = sh()

    expect(script.startsWith('#!/usr/bin/env bash')).toBe(true)
    expect(script).toContain('set -euo pipefail')
  })

  it('écrit la liste via un heredoc protégé de toute expansion', () => {
    expect(sh()).toContain("<<'URLS'")
  })

  it('utilise des fins de ligne LF', () => {
    expect(sh()).not.toContain('\r')
  })
})
