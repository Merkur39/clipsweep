/** The translated languages. The first has no precedence: see `FALLBACK_LOCALE`. */
export const LOCALES = ['fr', 'en'] as const

export type Locale = (typeof LOCALES)[number]

/**
 * What the visitor can choose, and therefore what gets stored.
 *
 * `auto` is not a third language: it is the act of asserting nothing, and
 * letting the browser decide. Without that sentinel, a French visitor who had
 * clicked "FR" would stay in French after switching their system to English —
 * exactly what the choice did not express.
 */
export const LOCALE_CHOICES = ['auto', ...LOCALES] as const

export type LocaleChoice = (typeof LOCALE_CHOICES)[number]

/**
 * The language for a visitor none of whose languages are translated.
 *
 * English rather than French: the tool is written in French, but this fallback
 * concerns precisely those who do not read it.
 */
export const FALLBACK_LOCALE: Locale = 'en'

const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value)

/**
 * The language to serve according to `navigator.languages`, taken in the order
 * of preference declared.
 *
 * The region is ignored — we translate neither Québécois nor Australian apart.
 * A language that is not translated is skipped rather than triggering the
 * fallback: a German visitor who also reads French prefers French to English.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.split('-')[0].toLowerCase()
    if (isLocale(primary)) return primary
  }
  return FALLBACK_LOCALE
}

/**
 * The preference lives in localStorage, so it is hand-editable and may date from
 * a version that named the languages differently. Anything that is not a
 * recognized choice falls back to detection, which is always a valid state.
 */
export function parseLocaleChoice(stored: string | null): LocaleChoice {
  return stored !== null && (LOCALE_CHOICES as readonly string[]).includes(stored)
    ? (stored as LocaleChoice)
    : 'auto'
}

/** The choice weighed against the browser: an explicit choice always wins. */
export function resolveLocale(choice: LocaleChoice, languages: readonly string[]): Locale {
  return choice === 'auto' ? detectLocale(languages) : choice
}

/**
 * Puts the language on `<html>`.
 *
 * The attribute is not decorative: it drives screen-reader pronunciation and
 * hyphenation. `index.html` hard-codes it to `fr`, a value that cannot follow
 * the choice — this is where it becomes true.
 */
export function applyLocale(root: HTMLElement, locale: Locale): void {
  root.setAttribute('lang', locale)
}
