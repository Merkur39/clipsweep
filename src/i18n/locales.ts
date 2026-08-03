/** Les langues traduites. La première n'a pas de préséance : voir `FALLBACK_LOCALE`. */
export const LOCALES = ['fr', 'en'] as const

export type Locale = (typeof LOCALES)[number]

/**
 * Ce que le visiteur peut choisir, et donc ce qui s'enregistre.
 *
 * `auto` n'est pas une troisième langue : c'est le fait de ne rien affirmer, et
 * de laisser le navigateur trancher. Sans ce sentinelle, un visiteur français
 * ayant cliqué « FR » resterait en français après avoir passé son système en
 * anglais — exactement ce que le choix n'exprimait pas.
 */
export const LOCALE_CHOICES = ['auto', ...LOCALES] as const

export type LocaleChoice = (typeof LOCALE_CHOICES)[number]

/**
 * La langue d'un visiteur dont aucune n'est traduite.
 *
 * L'anglais plutôt que le français : l'outil est écrit en français, mais ce
 * repli-ci ne concerne justement que ceux qui ne le lisent pas.
 */
export const FALLBACK_LOCALE: Locale = 'en'

const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value)

/**
 * La langue à servir d'après `navigator.languages`, prise dans l'ordre de
 * préférence déclaré.
 *
 * La région est ignorée — on ne traduit ni le québécois ni l'australien à part.
 * Une langue non traduite est passée plutôt que de déclencher le repli : un
 * visiteur allemand qui lit aussi le français préfère le français à l'anglais.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.split('-')[0].toLowerCase()
    if (isLocale(primary)) return primary
  }
  return FALLBACK_LOCALE
}

/**
 * La préférence vit en localStorage, donc elle est modifiable à la main et peut
 * dater d'une version qui nommait les langues autrement. Tout ce qui n'est pas
 * un choix reconnu revient à la détection, qui est toujours un état valable.
 */
export function parseLocaleChoice(stored: string | null): LocaleChoice {
  return stored !== null && (LOCALE_CHOICES as readonly string[]).includes(stored)
    ? (stored as LocaleChoice)
    : 'auto'
}

/** Le choix confronté au navigateur : un choix explicite l'emporte toujours. */
export function resolveLocale(choice: LocaleChoice, languages: readonly string[]): Locale {
  return choice === 'auto' ? detectLocale(languages) : choice
}

/**
 * Pose la langue sur `<html>`.
 *
 * L'attribut n'est pas décoratif : il pilote la prononciation des lecteurs
 * d'écran et la césure. `index.html` le code en dur à `fr`, valeur qui ne peut
 * pas suivre le choix — c'est ici qu'il devient vrai.
 */
export function applyLocale(root: HTMLElement, locale: Locale): void {
  root.setAttribute('lang', locale)
}
