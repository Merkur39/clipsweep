// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { applyTheme, parseTheme, THEMES } from './theme'

const root = () => document.documentElement

describe('parseTheme', () => {
  it('returns the three choices as they are', () => {
    for (const theme of THEMES) {
      expect(parseTheme(theme)).toBe(theme)
    }
  })

  it('falls back to following the system with no stored preference', () => {
    expect(parseTheme(null)).toBe('system')
  })

  // The preference lives in localStorage: it may have been tampered with by hand.
  it('falls back to the system rather than applying anything at all', () => {
    for (const corrupt of ['', 'clair', 'LIGHT', '{}', 'null']) {
      expect(parseTheme(corrupt)).toBe('system')
    }
  })
})

describe('applyTheme', () => {
  it('marks the explicit choice on the root', () => {
    applyTheme(root(), 'light')

    expect(root().getAttribute('data-theme')).toBe('light')
  })

  it('replaces a previous choice instead of adding to it', () => {
    applyTheme(root(), 'light')
    applyTheme(root(), 'dark')

    expect(root().getAttribute('data-theme')).toBe('dark')
  })

  // Following the system means asserting nothing: the attribute must disappear,
  // otherwise `color-scheme` would stay restricted to the previous branch.
  it('clears every mark when going back to the system', () => {
    applyTheme(root(), 'dark')
    applyTheme(root(), 'system')

    expect(root().hasAttribute('data-theme')).toBe(false)
  })
})
