import type { PlatformHints } from './scripts'

/**
 * The key the platform calls "command", as it has to be drawn.
 *
 * Not a message: both spellings are the same in every language, and neither is
 * a word to translate — one is a glyph, the other is the name printed on the
 * key itself.
 */
export const COMMAND_LABEL = { apple: '⌘', other: 'Ctrl' } as const

/**
 * A shortcut as it gets drawn, in the notation each platform uses: Apple writes
 * the glyph against the letter, everyone else joins the two with a plus.
 *
 * Not a message either: this is a key combination, and it is spelled the same
 * way in every language.
 */
export const commandShortcut = (apple: boolean, key: string) =>
  apple ? `${COMMAND_LABEL.apple}${key}` : `${COMMAND_LABEL.other}+${key}`

/**
 * Whether the visitor's keyboard carries a command key.
 *
 * It decides which shortcut the interface draws, and drawing the wrong one is
 * worse than drawing none: it teaches a key combination that does nothing.
 *
 * Same hints as [detectScriptFlavor], read differently — that one only has to
 * tell Windows from the rest, this one has to tell Apple from the rest, and
 * "macOS or Linux" answers neither question on its own.
 */
export function isApplePlatform({ platform, userAgent }: PlatformHints): boolean {
  const hint = platform?.trim()
  if (hint) return /^(macos|ios|ipados)$/i.test(hint)

  // Android first: its user agent also says "Linux", and it carries no command
  // key at all.
  if (/Android/i.test(userAgent)) return false
  return /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(userAgent)
}
