import type { T } from '../i18n/translate'
import type { Progress } from '../twitch/types'

export interface EmptyResultsInput {
  /**
   * The channel the search actually ran on — not the one the field holds now.
   * A channel that returned nothing at all is the one empty table a typo
   * explains, and naming it is what lets the reader check the spelling without
   * leaving the page. Named from the field instead, it would rename itself
   * under the reader's eyes the moment they started typing the next one.
   */
  channel: string
  /** A search has reported progress at least once in this session. */
  searched: boolean
  /** A search is under way: nothing about the outcome is settled yet. */
  running: boolean
  /** Clips collected before the view filter is applied. */
  clipsFound: number
  maxViews: number | null
  /** Display range, in `yyyy-mm-dd`. Two null bounds mean no range. */
  period?: { from: string | null; to: string | null }
  /** The free-text search, as it was typed. Empty means none. */
  query?: string
}

export interface RunProgressInput {
  /** Slices behind the search. */
  done: number
  /** Slices in all, as the search currently understands the period. */
  total: number
  /** Milliseconds of the period behind the search — see [Progress]. */
  coveredMs: number
  /** Milliseconds of the whole period. */
  periodMs: number
  /** Milliseconds since the search started. */
  elapsedMs: number
}

/**
 * How long is left, extrapolated from the search itself: how much of the period
 * it has walked, in the time it took.
 *
 * Not from a rate measured once and written down — a channel with ten years of
 * clips and one with a quarter's do not answer at the same speed, and neither
 * does the same channel at eight in the evening. The estimate is refreshed
 * whenever the ground moves, and it is announced as an estimate.
 *
 * And not from the slice count either, which is the count beside it: that
 * denominator grows every time a saturated window is halved, so the work left
 * grew with it and the estimate lengthened at each split — the same defect as
 * the bar sliding backwards, said in words instead of pixels.
 *
 * Nothing before the first ground is covered: the first slice of a long search
 * can take a minute on its own, and an estimate built on it would be a number
 * invented to fill a hole.
 */
function describeRemaining(
  coveredMs: number,
  periodMs: number,
  elapsedMs: number,
  t: T,
): string | null {
  if (coveredMs <= 0 || coveredMs >= periodMs) return null

  const left = (elapsedMs / coveredMs) * (periodMs - coveredMs)
  const minutes = Math.round(left / 60_000)

  // Rounded down to nothing, an estimate reads as "finished".
  return minutes < 1 ? t('run.eta.soon') : t('run.eta.minutes', { n: minutes })
}

/**
 * Where the search stands, under its own progress bar: the slices behind it,
 * and how long the rest is likely to take.
 *
 * Two measures, and on purpose. The slices are a count of the work, and they
 * are what speaks during the long silence before any ground is covered — the
 * bar has no fraction to draw then, and this line is the whole of what the
 * screen can say. The period is what the estimate is built on, being the only
 * measure of the search that cannot go backwards.
 *
 * Null while the slicing is still being worked out: "0 of 0" is not a reading of
 * anything, and the bar above already says that something is under way.
 */
export function describeRunProgress(
  { done, total, coveredMs, periodMs, elapsedMs }: RunProgressInput,
  t: T,
): string | null {
  if (total === 0) return null

  const slices = t('run.slices', { n: done, total })
  const remaining = describeRemaining(coveredMs, periodMs, elapsedMs, t)

  return remaining === null ? slices : `${slices} · ${remaining}`
}

export interface SearchResumeInput {
  progress: Progress | null
  /** Slices Helix saturated, which the search had to halve and run again. */
  split: number
}

/**
 * What the technical drawer says while it is folded.
 *
 * It is on screen at all times, so what it reads folded is the whole of what it
 * is worth: a fold that only says "details" has to be opened before it can be
 * judged, which is a thing one does once and never again. Read this instead and
 * the drawer stays shut with nothing lost.
 *
 * Segments joined rather than one sentence, as the result counts already are:
 * three counts in one message could agree with none of them. The halving is left
 * out when there was none — a segment reading "0" of something that did not
 * happen is a segment spent on nothing.
 */
export function describeSearchResume({ progress, split }: SearchResumeInput, t: T): string | null {
  if (!progress) return null

  return [
    t('progress.resume.slices', { n: progress.windowsTotal }),
    ...(split > 0 ? [t('progress.resume.split', { n: split })] : []),
    t('progress.resume.requests', { n: progress.requests }),
  ].join(' · ')
}

export interface TallyInput {
  /** After the display filters. */
  shown: number
  selected: number
}

/**
 * The two numbers that describe the display rather than the search.
 *
 * The count found is not among them: it answers what was asked, and leads the
 * ticket on its own line at its own weight. These two are footnotes to it — how
 * much of it is on screen, and how much of that is picked.
 *
 * Joined segments rather than one sentence: each number agrees with itself,
 * which no single form could manage. The separator is neutral, so it belongs to
 * neither language.
 */
export function describeTally({ shown, selected }: TallyInput, t: T): string {
  return [
    t('results.count.shown', { n: shown }),
    t('results.count.selected', { n: selected }),
  ].join(' · ')
}

/** The range as it reads, according to which bounds are actually set. */
function describeRange(from: string | null, to: string | null, t: T): string | null {
  if (from && to) return t('results.range.between', { from: { day: from }, to: { day: to } })
  if (from) return t('results.range.from', { from: { day: from } })
  if (to) return t('results.range.to', { to: { day: to } })
  return null
}

/**
 * Why the table is empty, and what to do about it. Silence here is the worst
 * outcome: a filter that hides every clip looks exactly like a failed search.
 */
export function describeEmptyResults(
  { channel, searched, running, clipsFound, maxViews, period, query = '' }: EmptyResultsInput,
  t: T,
): string {
  // A running search has been launched, whatever it has reported so far: it
  // reports nothing until its first slice comes back, and on a long period that
  // is a minute of inviting a search that is already under way.
  if (!searched && !running) return t('results.empty.notSearched')

  // A search runs from a few seconds to several minutes. Concluding that there
  // are no clips before the first slice has returned is false — and the advice
  // that follows ("widen the range") would restart it all for nothing.
  if (running && clipsFound === 0) return t('results.empty.running')

  if (clipsFound === 0) return t('results.empty.nothing', { channel })

  // First of the filters, because it is the last thing typed: a reader who has
  // just written six letters into a search box reads the answer to those six
  // letters, not to a date range set by the search minutes ago.
  if (query.trim() !== '') return t('results.empty.query', { n: clipsFound, query: query.trim() })

  // Named before the view threshold when both are active: the range is what the
  // user just narrowed by hand, and it is the one the empty table's action
  // offers to reopen.
  const range = describeRange(period?.from ?? null, period?.to ?? null, t)
  if (range !== null) return t('results.empty.outOfRange', { n: clipsFound, range })

  if (maxViews !== null) {
    return t('results.empty.aboveViews', {
      n: clipsFound,
      max: t('results.views', { n: maxViews }),
    })
  }

  return t('results.empty.filtered', { n: clipsFound })
}
