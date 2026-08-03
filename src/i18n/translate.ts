import { formatCount, formatDay } from './format'
import type { Locale } from './locales'
import type { Message, Params, Plural } from './message'
import { en } from './messages.en'
import { fr, type MessageKey } from './messages.fr'

const CATALOGUES = { fr, en } as const

const rules = new Map<Locale, Intl.PluralRules>()

function pluralRules(locale: Locale): Intl.PluralRules {
  const existing = rules.get(locale)
  if (existing) return existing

  const created = new Intl.PluralRules(locale)
  rules.set(locale, created)
  return created
}

/**
 * La forme d'un message pluriel, choisie sur le paramètre `n`.
 *
 * Sans décompte il n'y a rien à accorder : `other` est la forme neutre, et
 * c'est celle qui se lit le moins mal si un appelant oublie son `n`.
 */
function pick(message: Plural, locale: Locale, params: Params): string {
  const count = params.n
  if (typeof count !== 'number') return message.other

  return pluralRules(locale).select(count) === 'one' ? message.one : message.other
}

/**
 * Un message rendu : forme choisie, puis marqueurs substitués.
 *
 * Un paramètre manquant laisse son `{marqueur}` en place plutôt que d'écrire
 * « undefined » — le trou se voit à la relecture comme au test de parité, alors
 * qu'un mot anglais surgi au milieu d'une phrase passe inaperçu.
 */
export function render(message: Message, locale: Locale, params: Params = {}): string {
  const template = typeof message === 'string' ? message : pick(message, locale, params)

  return template.replace(/\{(\w+)\}/g, (marker, name: string) => {
    const value = params[name]
    if (value === undefined) return marker
    if (typeof value === 'number') return formatCount(value, locale)
    if (typeof value === 'string') return value
    return formatDay(value.day, locale)
  })
}

/**
 * La fonction de traduction d'une langue.
 *
 * Elle se passe en argument plutôt que de se lire dans un contexte : la couche
 * domaine est pure et testée hors de React, et doit le rester.
 */
export type T = (key: MessageKey, params?: Params) => string

export function makeT(locale: Locale): T {
  const catalogue = CATALOGUES[locale]
  return (key, params) => render(catalogue[key], locale, params)
}
