import { describe, expect, it } from 'vitest'

import { en } from './messages.en'
import { fr } from './messages.fr'
import { LOCALES } from './locales'

const CATALOGUES = { fr, en } as const

/** The parameters a message expects, in the order they appear. */
const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

const forms = (message: string | { one: string; other: string }) =>
  typeof message === 'string' ? [message] : [message.one, message.other]

/**
 * The main guarantee — a missing key, a plain form where a plural is needed —
 * is held by the type system: `en` is declared `Catalogue`, derived from `fr`.
 * What remains here are the divergences the types cannot see.
 */
describe('catalogues', () => {
  it('carry exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  // A translation that forgets a `{n}`, or invents one, produces either a
  // missing count or a hole displayed as-is in the interface.
  it('expect the same parameters in both languages', () => {
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      const expected = placeholders(forms(fr[key]).join(' '))
      const actual = placeholders(forms(en[key]).join(' '))

      expect(actual, `parameters of "${key}"`).toEqual(expected)
    }
  })

  it('leave no message empty', () => {
    for (const locale of LOCALES) {
      for (const [key, message] of Object.entries(CATALOGUES[locale])) {
        for (const form of forms(message)) {
          expect(form.trim(), `"${key}" in ${locale}`).not.toBe('')
        }
      }
    }
  })

  /**
   * The `.bat` and `.sh` scripts run in a console whose code page is not
   * guaranteed: an accent comes out as garbage there. Those messages therefore
   * stay pure ASCII, in both languages — a free constraint in English, an
   * accepted one in French.
   */
  it('keep the script messages ASCII', () => {
    for (const locale of LOCALES) {
      for (const [key, message] of Object.entries(CATALOGUES[locale])) {
        if (!key.startsWith('script.')) continue

        for (const form of forms(message)) {
          // eslint-disable-next-line no-control-regex
          expect(form, `"${key}" in ${locale}`).toMatch(/^[\x00-\x7F]*$/)
        }
      }
    }
  })
})
