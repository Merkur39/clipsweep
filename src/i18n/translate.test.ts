import { describe, expect, it } from 'vitest'

import { makeT, render } from './translate'

describe('render', () => {
  it('renders a plain string as it is', () => {
    expect(render('Déconnecté de Twitch.', 'fr')).toBe('Déconnecté de Twitch.')
  })

  it('substitutes the named parameters', () => {
    expect(render('Chaîne « {login} » introuvable.', 'fr', { login: 'zerator' })).toBe(
      'Chaîne « zerator » introuvable.',
    )
  })

  it('substitutes the same parameter several times', () => {
    expect(render('{a} → {a}', 'fr', { a: 'x' })).toBe('x → x')
  })

  // A missing parameter leaves its marker rather than writing "undefined":
  // the hole shows on review as it does in the parity test.
  it('leaves the hole visible when the parameter is missing', () => {
    expect(render('{a} et {b}', 'fr', { a: 'x' })).toBe('x et {b}')
  })

  // Numbers meant to be read are grouped — that is the default rule, since
  // nearly every interpolated number is a count.
  it('groups interpolated numbers according to the language', () => {
    expect(render('{n} clips', 'fr', { n: 1234 })).toBe(`1${String.fromCharCode(0x00a0)}234 clips`)
    expect(render('{n} clips', 'en', { n: 1234 })).toBe('1,234 clips')
  })

  // The escape hatch: an identifier, a year or an HTTP code is passed as a
  // string, and goes through with no thousands separator.
  it('leaves a value already a string untouched', () => {
    expect(render('Twitch répond {status}', 'fr', { status: '404' })).toBe('Twitch répond 404')
  })

  // Dates follow the same logic as numbers: the caller declares an intent, the
  // engine knows the language. The domain layer therefore never needs the
  // language served to compose a dated sentence.
  it('renders a day in the language’s order', () => {
    expect(render('depuis le {d}', 'fr', { d: { day: '2026-08-03' } })).toBe('depuis le 03/08/2026')
    expect(render('since {d}', 'en', { d: { day: '2026-08-03T22:41:07Z' } })).toBe(
      'since 08/03/2026',
    )
  })

  describe('pluriel', () => {
    const clips = { one: '{n} clip récupéré', other: '{n} clips récupérés' }

    it('choisit la forme sur `n`', () => {
      expect(render(clips, 'fr', { n: 1 })).toBe('1 clip récupéré')
      expect(render(clips, 'fr', { n: 2 })).toBe('2 clips récupérés')
      expect(render(clips, 'fr', { n: 0 })).toBe('0 clip récupéré')
    })

    /**
     * Zero separates the two languages, and that is the whole point of
     * delegating to `Intl.PluralRules`: French agrees "0 clip" in the singular,
     * English says "0 clips". A hand-written `n > 1` rule would get this wrong.
     */
    it('follows the language’s own rule on zero', () => {
      const found = { one: '{n} clip found', other: '{n} clips found' }

      expect(render(found, 'en', { n: 0 })).toBe('0 clips found')
      expect(render(found, 'en', { n: 1 })).toBe('1 clip found')
    })
  })
})

describe('makeT', () => {
  it('serves the catalogue of the language asked for', () => {
    expect(makeT('fr')('access.disconnected')).toBe('Déconnecté de Twitch.')
    expect(makeT('en')('access.disconnected')).not.toBe(makeT('fr')('access.disconnected'))
  })

  it('agrees according to the language served', () => {
    expect(makeT('fr')('results.count.found', { n: 1 })).toBe('1 clip récupéré')
    expect(makeT('fr')('results.count.found', { n: 2 })).toBe('2 clips récupérés')
    expect(makeT('en')('results.count.found', { n: 1 })).toBe('1 clip collected')
  })
})
