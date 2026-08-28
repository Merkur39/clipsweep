import { parseThreshold } from '../domain/filters'
import { formatCount, formatDay } from '../i18n/format'
import type { Locale } from '../i18n/locales'

/**
 * What the views chip reads after its label — or null, which is what keeps the
 * chip a bare word when neither threshold is set.
 *
 * The three shapes take no message key. `≥`, `≤` and the en dash are read the
 * same in both catalogues: keying them would be three sentences to translate
 * that no language translates differently, and one more place for the two
 * catalogues to drift. The numbers inside them are grouped by the locale, which
 * is the part that does change.
 */
export function describeViewRange(min: string, max: string, locale: Locale): string | null {
  const floor = parseThreshold(min)
  const ceiling = parseThreshold(max)
  const count = (value: number) => formatCount(value, locale)

  if (floor !== null && ceiling !== null) return `${count(floor)} – ${count(ceiling)}`
  if (floor !== null) return `≥ ${count(floor)}`
  if (ceiling !== null) return `≤ ${count(ceiling)}`
  return null
}

/**
 * What the dates chip reads after its label: the range the two fields hold, as
 * they hold it.
 *
 * Deliberately **not** the range as it narrows. A search fills both fields with
 * the period it ran on, and the chip shows that period from then on — set, and
 * lit. It was written the other way round first, reading the range through
 * `narrowedRange` so that a period holding nothing back left the chip a bare
 * word; Alexis called it: the fields ARE set after a search, and a chip that
 * denied it would be hiding the one thing it exists to show.
 *
 * The open side keeps its arrow rather than losing it: "01/03/2024 →" says the
 * range is half-open, where a lone date would read as a single day.
 */
export function describeDayRange(
  range: { from: string; to: string },
  locale: Locale,
): string | null {
  const from = range.from || null
  const to = range.to || null
  if (from === null && to === null) return null

  const day = (iso: string) => formatDay(iso, locale)
  if (from !== null && to !== null) return `${day(from)} → ${day(to)}`
  return from !== null ? `${day(from)} →` : `→ ${day(to!)}`
}
