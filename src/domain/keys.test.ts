import { describe, expect, it } from 'vitest'

import { COMMAND_LABEL, commandShortcut, isApplePlatform } from './keys'

/**
 * Which key the interface has to draw for "command": ⌘ on Apple, Ctrl
 * everywhere else. Drawing the wrong one is worse than drawing none — it teaches
 * a shortcut that does nothing.
 */
describe('isApplePlatform', () => {
  it('reads the platform hint when the browser gives one', () => {
    expect(isApplePlatform({ platform: 'macOS', userAgent: '' })).toBe(true)
    expect(isApplePlatform({ platform: 'Windows', userAgent: '' })).toBe(false)
    expect(isApplePlatform({ platform: 'Linux', userAgent: '' })).toBe(false)
  })

  // An iPad's user agent says "Mac OS X", and that is the right answer here:
  // a hardware keyboard on an iPad carries a command key.
  it('falls back on the user agent', () => {
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe(
      true,
    )
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })).toBe(true)
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe(false)
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe(false)
  })

  // Android says "Linux" in its user agent, and carries no command key at all.
  it('says no for Android', () => {
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe(false)
  })
})

describe('COMMAND_LABEL', () => {
  it('draws the glyph on Apple and the word elsewhere', () => {
    expect(COMMAND_LABEL.apple).toBe('⌘')
    expect(COMMAND_LABEL.other).toBe('Ctrl')
  })
})

// Each platform's own notation: the glyph sits against the letter, the word
// joins it with a plus. Writing "⌘+K" is a tell that nobody read the platform.
describe('commandShortcut', () => {
  it('spells the combination the way its platform does', () => {
    expect(commandShortcut(true, 'K')).toBe('⌘K')
    expect(commandShortcut(false, 'K')).toBe('Ctrl+K')
  })
})
