import type { Locale } from './locales'

/**
 * The separators are built from code points rather than written out: in the
 * clear they are invisible characters, indistinguishable on review as on a diff.
 */
/** Narrow no-break space, and thin space. */
const THIN_SPACES = new RegExp(`[${String.fromCharCode(0x202f, 0x2009)}]`, 'g')
/** The ordinary no-break space: present everywhere, and one digit wide. */
const NBSP = String.fromCharCode(0x00a0)

/**
 * The formatters are memoized per language: `ClipTable` calls one per row, and
 * building an `Intl.NumberFormat` costs far more than formatting with it.
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
 * The day in digits, in the language's own order.
 *
 * `dateStyle: 'short'` would be more idiomatic but gives `8/3/26` in English:
 * the width would vary from one row to the next, and the date column, aligned
 * with `tabular-nums`, would stop being comparable at a glance. Two-digit fields
 * hold the alignment in both languages.
 *
 * In UTC, like the bounds sent to Helix, the fields' default value and the day
 * the filters compare against: formatting in local time would shift the display
 * by one day west of Greenwich.
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
 * A number meant to be read, grouped in thousands.
 *
 * `Intl` separates the groups with a **narrow** no-break space in fr-FR, which
 * several monospace fonts lack: it then falls back to a glyph of a different
 * width and knocks the views column out of alignment, the very thing
 * `tabular-nums` had just made comparable. So we normalize it.
 *
 * Display only. The CSV and JSON exports and the URL list emit raw values: they
 * are read back by machines.
 */
export function formatCount(value: number, locale: Locale): string {
  return counts(locale).format(value).replace(THIN_SPACES, NBSP)
}

/**
 * A day meant to be read, from a `yyyy-mm-dd` or a full timestamp — the sweep
 * bounds, `created_at` and the windows arrive in both shapes.
 *
 * Display only here as well: the bounds sent to Helix, the values of the
 * `<input type="date">` fields, the exported file names and the exports
 * themselves stay in `yyyy-mm-dd`, where lexicographic order is chronological
 * order.
 */
export function formatDay(iso: string, locale: Locale): string {
  return days(locale).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
}

/**
 * A clip's length, on its badge.
 *
 * The one reading here that takes no language: `m:ss` keeps the same order and
 * the same separator everywhere, where a count changes its grouping and a date
 * its field order. Taking a locale would announce a choice that does not exist.
 *
 * Helix serves the duration as a float — 59.6 s is a minute, not fifty-nine
 * seconds and a badge that lies by one.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
