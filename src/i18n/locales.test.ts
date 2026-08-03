// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { applyLocale, detectLocale, parseLocaleChoice, resolveLocale } from './locales'

describe('detectLocale', () => {
  it('keeps the first browser language that is translated', () => {
    expect(detectLocale(['fr-FR', 'fr', 'en-US'])).toBe('fr')
    expect(detectLocale(['en-GB', 'fr'])).toBe('en')
  })

  // The regional subtag is none of our business: we translate neither Québécois
  // nor Australian separately.
  it('ignores the region', () => {
    expect(detectLocale(['fr-CA'])).toBe('fr')
    expect(detectLocale(['EN-au'])).toBe('en')
  })

  // An untranslated language must not short-circuit the one that follows: a
  // German visitor who also reads French prefers French to English.
  it('skips the untranslated languages', () => {
    expect(detectLocale(['de-DE', 'fr-FR', 'en'])).toBe('fr')
  })

  it('falls back to English when nothing matches', () => {
    expect(detectLocale(['de', 'es'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('parseLocaleChoice', () => {
  it('recognizes the three choices', () => {
    expect(parseLocaleChoice('auto')).toBe('auto')
    expect(parseLocaleChoice('fr')).toBe('fr')
    expect(parseLocaleChoice('en')).toBe('en')
  })

  // Same rule as the theme: the preference lives in localStorage, so it is
  // hand-editable and may date from a version that named the languages
  // differently. Anything that is not a recognized choice returns to detection.
  it('returns to detection on an unknown value', () => {
    expect(parseLocaleChoice('de')).toBe('auto')
    expect(parseLocaleChoice('')).toBe('auto')
    expect(parseLocaleChoice(null)).toBe('auto')
  })
})

describe('resolveLocale', () => {
  it('honours an explicit choice against the browser', () => {
    expect(resolveLocale('en', ['fr-FR'])).toBe('en')
    expect(resolveLocale('fr', ['en-US'])).toBe('fr')
  })

  it('follows the browser on automatic', () => {
    expect(resolveLocale('auto', ['fr-FR'])).toBe('fr')
    expect(resolveLocale('auto', ['de'])).toBe('en')
  })
})

describe('applyLocale', () => {
  // The attribute drives screen-reader pronunciation and hyphenation; the
  // `lang="fr"` hard-coded in index.html cannot follow the choice.
  it('puts the language on the document root', () => {
    const root = document.createElement('html')

    applyLocale(root, 'en')
    expect(root.getAttribute('lang')).toBe('en')

    applyLocale(root, 'fr')
    expect(root.getAttribute('lang')).toBe('fr')
  })
})
