import type { T } from '../i18n/translate'
import type { Progress } from '../twitch/types'

export interface EmptyResultsInput {
  /** A search has run at least once in this session. */
  searched: boolean
  /** A search is under way: nothing about the outcome is settled yet. */
  running: boolean
  /** Clips collected before the view filter is applied. */
  clipsFound: number
  maxViews: number | null
  /** Display range, in `yyyy-mm-dd`. Two null bounds mean no range. */
  period?: { from: string | null; to: string | null }
}

export interface SearchStatusInput {
  running: boolean
  progress: Progress | null
  clipsFound: number
}

/**
 * A status line readable without knowing anything about the algorithm. For most
 * visitors it stands in for the frieze and the technical counters: those answer
 * "how", this one answers "where it stands".
 */
export function describeSearchStatus(
  { running, progress, clipsFound }: SearchStatusInput,
  t: T,
): string | null {
  if (!progress) return null

  if (running) {
    return t('results.status.running', {
      done: progress.windowsDone,
      total: progress.windowsTotal,
      n: progress.clipsFound,
    })
  }

  return t('results.status.done', { n: clipsFound || progress.clipsFound })
}

export interface ResultCountInput {
  /** Before any filter. */
  found: number
  /** After the display filters. */
  shown: number
  selected: number
}

/**
 * The three numbers that matter, always in the same order.
 *
 * Three joined segments rather than one sentence: each number agrees with
 * itself, which no single form could manage. The separator is neutral, so it
 * belongs to neither language.
 */
export function describeResultCount({ found, shown, selected }: ResultCountInput, t: T): string {
  if (found === 0) return ''

  return [
    t('results.count.found', { n: found }),
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
  { searched, running, clipsFound, maxViews, period }: EmptyResultsInput,
  t: T,
): string {
  if (!searched) return t('results.empty.notSearched')

  // A sweep runs from a few seconds to several minutes. Concluding that there
  // are no clips before the first period has returned is false — and the advice
  // that follows ("widen the range") would restart it all for nothing.
  if (running && clipsFound === 0) return t('results.empty.running')

  if (clipsFound === 0) return t('results.empty.nothing')

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
