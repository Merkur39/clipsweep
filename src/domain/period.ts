import type { T } from '../i18n/translate'

/**
 * The effective start date: never earlier than the channel's creation.
 *
 * A period that begins before the channel existed can return nothing, and costs
 * one yearly window — so at least one request — per year too many, plus as many
 * empty slabs on the frieze.
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
 * The month before a `yyyy-mm-dd` date, in UTC like every other bound.
 *
 * This is the default value of the "From" field: a one-month period sweeps in a
 * handful of requests, where a start set at the dawn of Twitch spends one per
 * yearly window — an expense an immediate click on "Start the sweep" commits
 * without anyone having asked for it.
 *
 * The day of month is pulled back to the last day of the target month when it
 * does not exist there: `setMonth` would slide onto the following month, and
 * would return, for 31 March, a date later than the one we started from.
 */
export function monthBefore(today: string): string {
  const [year, month, dayOfMonth] = today.split('-').map(Number)
  const previousMonth = month === 1 ? 12 : month - 1
  const previousYear = month === 1 ? year - 1 : year
  // Day 0 of the following month, that is the last day of the target month —
  // leap years included.
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate()

  return `${pad(previousYear, 4)}-${pad(previousMonth, 2)}-${pad(Math.min(dayOfMonth, lastDay), 2)}`
}

/**
 * The sweep bounds the end at `23:59:59`, so a start and an end on the same day
 * do cover that day: only a **later** start is at fault.
 *
 * One key serves both the interface and the log: whoever fixes the period must
 * read the same message as the one found in the technical trace.
 */
export function describePeriodError(since: string, until: string, t: T): string | null {
  return since > until ? t('period.order') : null
}
