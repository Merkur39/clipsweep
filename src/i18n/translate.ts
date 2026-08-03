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
 * The form of a plural message, chosen on the `n` parameter.
 *
 * With no count there is nothing to agree: `other` is the neutral form, and the
 * one that reads least badly if a caller forgets its `n`.
 */
function pick(message: Plural, locale: Locale, params: Params): string {
  const count = params.n
  if (typeof count !== 'number') return message.other

  return pluralRules(locale).select(count) === 'one' ? message.one : message.other
}

/**
 * A rendered message: form chosen, then markers substituted.
 *
 * A missing parameter leaves its `{marker}` in place rather than writing
 * "undefined" — the hole shows on review as it does in the parity test, whereas
 * an English word surfacing mid-sentence goes unnoticed.
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
 * A language's translation function.
 *
 * It is passed as an argument rather than read from a context: the domain layer
 * is pure and tested outside React, and must stay that way.
 */
export type T = (key: MessageKey, params?: Params) => string

export function makeT(locale: Locale): T {
  const catalogue = CATALOGUES[locale]
  return (key, params) => render(catalogue[key], locale, params)
}
