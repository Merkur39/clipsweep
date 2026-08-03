import { describe, expect, it } from 'vitest'

import { en } from './messages.en'
import { fr } from './messages.fr'
import { LOCALES } from './locales'

const CATALOGUES = { fr, en } as const

/** Les paramètres qu'un message attend, dans l'ordre où ils apparaissent. */
const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

const forms = (message: string | { one: string; other: string }) =>
  typeof message === 'string' ? [message] : [message.one, message.other]

/**
 * La garantie principale — clé manquante, forme simple là où il faut un pluriel
 * — est tenue par le typage : `en` est déclaré `Catalogue`, dérivé de `fr`.
 * Restent ici les divergences que les types ne voient pas.
 */
describe('catalogues', () => {
  it('portent exactement les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  // Une traduction qui oublie un `{n}`, ou qui en invente un, produit soit un
  // décompte absent soit un trou affiché tel quel dans l'interface.
  it('attendent les mêmes paramètres dans les deux langues', () => {
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      const expected = placeholders(forms(fr[key]).join(' '))
      const actual = placeholders(forms(en[key]).join(' '))

      expect(actual, `paramètres de « ${key} »`).toEqual(expected)
    }
  })

  it('ne laissent aucun message vide', () => {
    for (const locale of LOCALES) {
      for (const [key, message] of Object.entries(CATALOGUES[locale])) {
        for (const form of forms(message)) {
          expect(form.trim(), `« ${key} » en ${locale}`).not.toBe('')
        }
      }
    }
  })

  /**
   * Les scripts `.bat` et `.sh` s'exécutent dans une console dont la page de
   * code n'est pas garantie : un accent y sort en charabia. Ces messages-là
   * restent donc en ASCII pur, dans les deux langues — contrainte gratuite en
   * anglais, assumée en français.
   */
  it('gardent les messages de script en ASCII', () => {
    for (const locale of LOCALES) {
      for (const [key, message] of Object.entries(CATALOGUES[locale])) {
        if (!key.startsWith('script.')) continue

        for (const form of forms(message)) {
          // eslint-disable-next-line no-control-regex
          expect(form, `« ${key} » en ${locale}`).toMatch(/^[\x00-\x7F]*$/)
        }
      }
    }
  })
})
