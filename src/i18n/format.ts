import type { Locale } from './locales'

/**
 * Les séparateurs sont construits par point de code plutôt qu'écrits :
 * en clair ce sont des caractères invisibles, indiscernables à la relecture
 * comme au diff.
 */
/** Espace fine insécable, et espace fine. */
const THIN_SPACES = new RegExp(`[${String.fromCharCode(0x202f, 0x2009)}]`, 'g')
/** Insécable ordinaire : présente partout, et de la largeur d'un chiffre. */
const NBSP = String.fromCharCode(0x00a0)

/**
 * Les formateurs sont mémoïsés par langue : `ClipTable` en appelle un par
 * ligne, et construire un `Intl.NumberFormat` coûte bien plus que formater.
 */
const memo = <T>(build: (locale: Locale) => T) => {
  const cache = new Map<Locale, T>()
  return (locale: Locale): T => {
    const existing = cache.get(locale)
    if (existing) return existing

    const created = build(locale)
    cache.set(locale, created)
    return created
  }
}

const counts = memo((locale: Locale) => new Intl.NumberFormat(locale))

/**
 * Le quantième en chiffres, dans l'ordre de la langue.
 *
 * `dateStyle: 'short'` serait plus idiomatique mais donne `8/3/26` en anglais :
 * la largeur varierait d'une ligne à l'autre, et la colonne des dates, alignée
 * en `tabular-nums`, cesserait d'être comparable d'un coup d'œil. Les champs à
 * deux chiffres tiennent l'alignement dans les deux langues.
 *
 * En UTC, comme les bornes envoyées à Helix, la valeur par défaut des champs et
 * le jour sur lequel les filtres comparent : formater en heure locale
 * décalerait l'affichage d'un jour à l'ouest de Greenwich.
 */
const days = memo(
  (locale: Locale) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
)

/**
 * Un nombre destiné à être lu, groupé par milliers.
 *
 * `Intl` sépare les tranches par une espace **fine** insécable en fr-FR, que
 * plusieurs polices monospace n'ont pas : elle se replie alors sur un glyphe de
 * largeur différente et désaligne la colonne des vues, que `tabular-nums`
 * venait justement de rendre comparable. On la normalise donc.
 *
 * Réservé à l'affichage. Les exports CSV, JSON et la liste d'URLs sortent les
 * valeurs brutes : elles sont relues par des machines.
 */
export function formatCount(value: number, locale: Locale): string {
  return counts(locale).format(value).replace(THIN_SPACES, NBSP)
}

/**
 * Un jour destiné à être lu, à partir d'un `yyyy-mm-dd` ou d'un horodatage
 * complet — les bornes de scan, `created_at` et les fenêtres arrivent sous
 * les deux formes.
 *
 * Réservé à l'affichage, là encore : les bornes envoyées à Helix, les valeurs
 * des champs `<input type="date">`, le nom des fichiers exportés et les exports
 * eux-mêmes restent en `yyyy-mm-dd`, où l'ordre lexicographique est l'ordre
 * chronologique.
 */
export function formatDay(iso: string, locale: Locale): string {
  return days(locale).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
}
