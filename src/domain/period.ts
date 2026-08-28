import type { T } from '../i18n/translate'

/**
 * The effective start date: never earlier than the channel's creation.
 *
 * A period that begins before the channel existed can return nothing, and costs
 * one yearly window — so at least one request — per year too many, plus as many
 * empty slabs on the timeline.
 *
 * The constraint is **derived, not written**: the user's input stays as typed in
 * memory, and becomes valid again if the target channel changes to an older one.
 * Overwriting the field would destroy an intent still legitimate elsewhere.
 *
 * Dates are `yyyy-mm-dd`, where lexicographic order is chronological order.
 */
export function clampSince(since: string, channelCreatedAt: string | null): string {
  if (!channelCreatedAt) return since
  return since < channelCreatedAt ? channelCreatedAt : since
}

/**
 * The effective end date: never beyond today.
 *
 * The counterpart of [clampSince]: no clip can exist in the future, so windows
 * past today would return nothing while spending one request each.
 *
 * Derived as well, and for one more reason: time moves. A date typed too far
 * ahead becomes legitimate when the day comes — provided it was not overwritten
 * in the meantime.
 *
 * `today` is expressed in UTC, like the field's default value and like the
 * bounds sent to Helix.
 */
export function clampUntil(until: string, today: string): string {
  return until > today ? today : until
}

const pad = (value: number, width: number) => String(value).padStart(width, '0')

/**
 * A `Date` as the `yyyy-mm-dd` every bound in this module is expressed in, read
 * in UTC like the date fields and like what goes to Helix.
 *
 * A `Date` is the only thing here that ever becomes one of these strings, so
 * the conversion belongs with them. The clock does not: every function below
 * takes today as an argument, which is what makes the whole module answerable
 * without one.
 */
export const utcDay = (date: Date) =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`

/**
 * The day `count` days before a `yyyy-mm-dd` date, in UTC like every other
 * bound.
 *
 * This is what "the last thirty days" means, and it has to mean exactly that:
 * the shortcut says a number of days, so a same-day-last-month arithmetic would
 * hand back 28, 30 or 31 depending on the month and make the label a rough
 * approximation of what it did.
 */
export function daysBefore(today: string, count: number): string {
  const [year, month, dayOfMonth] = today.split('-').map(Number)
  return utcDay(new Date(Date.UTC(year, month - 1, dayOfMonth - count)))
}

/**
 * The same day of the month `count` months earlier, in UTC.
 *
 * The day of month is pulled back to the last day of the target month when it
 * does not exist there: `setMonth` would slide onto the following month, and
 * would return, for 31 March, a date later than the one we started from.
 */
export function monthsBefore(today: string, count: number): string {
  const [year, month, dayOfMonth] = today.split('-').map(Number)
  const target = month - 1 - count
  const targetYear = year + Math.floor(target / 12)
  // JavaScript's remainder keeps the sign of the dividend; months do not.
  const targetMonth = ((target % 12) + 12) % 12
  // Day 0 of the following month, that is the last day of the target month —
  // leap years included.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  return `${pad(targetYear, 4)}-${pad(targetMonth + 1, 2)}-${pad(Math.min(dayOfMonth, lastDay), 2)}`
}

/**
 * The day Twitch opened to the public. No clip predates it, whatever a period
 * asks for.
 *
 * It is the floor of "since the beginning" while the channel is still being
 * typed — the lookup that would give its creation date is debounced and may
 * never land at all. `clampSince` pulls the bound up as soon as it does, so the
 * shortcut costs no yearly window on years that cannot hold a clip.
 */
export const TWITCH_EPOCH = '2011-06-06'

export type PresetId = 'month' | 'year' | 'all'

export interface PeriodPreset {
  id: PresetId
  since: string
  until: string
}

export interface PeriodPresetsInput {
  /** `yyyy-mm-dd` in UTC, the far bound of all three. */
  today: string
  /** `yyyy-mm-dd`, or null while the channel is unknown. */
  channelCreatedAt: string | null
}

/**
 * The three shortcuts the open ticket offers, in the order they are read.
 *
 * They are what a period gets chosen with. The two date fields stay behind
 * "edit the dates" for the one reader in twenty who wants a fortnight in 2023 —
 * a shortcut that covers the three common cases is worth more than two fields
 * that cover every case and are typed into every time.
 */
export function periodPresets({ today, channelCreatedAt }: PeriodPresetsInput): PeriodPreset[] {
  return [
    { id: 'month', since: daysBefore(today, 30), until: today },
    { id: 'year', since: monthsBefore(today, 12), until: today },
    { id: 'all', since: channelCreatedAt ?? TWITCH_EPOCH, until: today },
  ]
}

/**
 * Which shortcut the period in the fields is on, if any.
 *
 * Read from the two bounds rather than remembered from the last click: a period
 * edited by hand belongs to no shortcut, and one typed back onto a shortcut's
 * dates belongs to it again. Nothing else would survive a reload, where the
 * bounds come back from `sessionStorage` and the click does not.
 */
export function activePreset(
  presets: readonly PeriodPreset[],
  since: string,
  until: string,
): PresetId | null {
  return presets.find((preset) => preset.since === since && preset.until === until)?.id ?? null
}

/**
 * The search bounds the end at `23:59:59`, so a start and an end on the same day
 * do cover that day: only a **later** start is at fault.
 *
 * One key serves both the interface and the log: whoever fixes the period must
 * read the same message as the one found in the technical trace.
 */
export function describePeriodError(since: string, until: string, t: T): string | null {
  return since > until ? t('period.order') : null
}
