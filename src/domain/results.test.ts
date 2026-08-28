import { describe, expect, it } from 'vitest'

import {
  describeEmptyResults,
  describeTally,
  describeSearchResume,
  describeRunProgress,
} from './results'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

/**
 * The drawer is always on screen and folded by default, so what it says folded is
 * the whole of what it is worth: a fold that only says "details" asks to be
 * opened before it can be judged, and is opened once and never again.
 */
describe('describeSearchResume', () => {
  it('says nothing before a search has anything to report', () => {
    expect(describeSearchResume({ progress: null, split: 0 }, t)).toBeNull()
  })

  it('counts the slices, the ones it had to halve, and the requests', () => {
    const text = describeSearchResume(
      {
        progress: {
          windowsDone: 96,
          windowsTotal: 96,
          coveredMs: 96,
          periodMs: 96,
          clipsFound: 4812,
          requests: 1288,
        },
        split: 3,
      },
      t,
    )

    expect(text).toContain('96')
    expect(text).toContain('3')
    // Grouped with the no-break space `formatCount` normalises to.
    expect(text).toContain('1' + String.fromCharCode(0x00a0) + '288')
  })

  // Nothing halved is the ordinary case: a segment that says "0" of something
  // that did not happen is a segment spent on nothing.
  it('leaves out the halving when nothing was halved', () => {
    const text = describeSearchResume(
      {
        progress: {
          windowsDone: 12,
          windowsTotal: 12,
          coveredMs: 12,
          periodMs: 12,
          clipsFound: 40,
          requests: 12,
        },
        split: 0,
      },
      t,
    )

    expect(text).not.toContain('relanc')
    expect(text).toContain('12')
  })

  // Each count agrees with itself: three of them in one sentence could agree
  // with none.
  it('agrees each count separately', () => {
    const text = describeSearchResume(
      {
        progress: {
          windowsDone: 1,
          windowsTotal: 1,
          coveredMs: 1,
          periodMs: 1,
          clipsFound: 0,
          requests: 1,
        },
        split: 1,
      },
      t,
    )

    expect(text).toBe('1 tranche · 1 relancée en deux · 1 requête')
  })
})

/**
 * Where the search stands, under its own progress bar: how many slices are
 * behind it, and how long the rest is likely to take.
 *
 * The estimate is extrapolated from the search itself — what it has done, in the
 * time it took — rather than from a rate measured once and hard-coded. A channel
 * with ten years of clips and one with a quarter's do not answer at the same
 * speed, and neither does the same channel at eight in the evening.
 */
describe('describeRunProgress', () => {
  /** A run whose two measures agree, which is the ordinary case. */
  const run = (done: number, total: number, elapsedMs: number) => ({
    done,
    total,
    coveredMs: done,
    periodMs: total,
    elapsedMs,
  })

  it('counts the slices behind and the slices in all', () => {
    const text = describeRunProgress(run(47, 96, 120_000), t)

    expect(text).toContain('47 tranches sur 96')
  })

  it('extrapolates what is left from what has been done', () => {
    // Half the period behind in two minutes: a shade over two more to go.
    const text = describeRunProgress(run(47, 96, 120_000), t)

    expect(text).toContain('environ 2 min restantes')
  })

  /**
   * The estimate is a rate, and its numerator has to be the one that only ever
   * grows. Read off the slice count it lengthened at every halving — the total
   * grew underneath it — which is the same defect as the bar sliding back, in
   * words instead of pixels. So the count still says how many slices there are,
   * and the estimate is not built on it.
   */
  it('extrapolates from the period covered, not from the slice count', () => {
    // Half the period behind in two minutes: two more to go. The slice counts
    // would have read a quarter left, and are not consulted.
    const text = describeRunProgress(
      { done: 9, total: 12, coveredMs: 50, periodMs: 100, elapsedMs: 120_000 },
      t,
    )

    expect(text).toBe('9 tranches sur 12 · environ 2 min restantes')
  })

  it('agrees the singular of both counts', () => {
    const text = describeRunProgress(run(1, 2, 60_000), t)

    expect(text).toBe('1 tranche sur 2 · environ 1 min restante')
  })

  // Rounding an estimate down to "0 min" would read as finished.
  it('says less than a minute rather than none', () => {
    const text = describeRunProgress(run(90, 96, 60_000), t)

    expect(text).toContain('moins d’une minute')
  })

  /**
   * Nothing covered, nothing to extrapolate from: the first slice of a long
   * search can take a minute on its own, and an estimate built on it would be a
   * number invented to fill a hole.
   *
   * The slice count still speaks, and has to: it is the only thing on screen
   * during that minute, and it is what the bar has no fraction to draw for.
   */
  it('offers no estimate before the first slice has landed', () => {
    const text = describeRunProgress(
      { done: 0, total: 96, coveredMs: 0, periodMs: 96, elapsedMs: 8_000 },
      t,
    )

    expect(text).toBe('0 tranche sur 96')
  })

  // A window that split leaves the ground unmoved: there is a slice behind the
  // search and still nothing to extrapolate from.
  it('offers none while the only slice behind it was one that got halved', () => {
    const text = describeRunProgress(
      { done: 1, total: 3, coveredMs: 0, periodMs: 96, elapsedMs: 20_000 },
      t,
    )

    expect(text).toBe('1 tranche sur 3')
  })

  it('offers none once every slice is behind it', () => {
    const text = describeRunProgress(run(96, 96, 240_000), t)

    expect(text).toBe('96 tranches sur 96')
  })

  // Before the first report there is no total either, and "0 of 0" is not a
  // reading of anything.
  it('says nothing at all while the slicing is still being worked out', () => {
    expect(describeRunProgress(run(0, 0, 3_000), t)).toBeNull()
  })
})

describe('describeTally', () => {
  it('gives what is shown and what is picked', () => {
    expect(describeTally({ shown: 87, selected: 40 }, t)).toBe('87 affichés · 40 sélectionnés')
  })

  it('agrees each number separately', () => {
    expect(describeTally({ shown: 1, selected: 1 }, t)).toBe('1 affiché · 1 sélectionné')
  })

  it('handles an empty selection', () => {
    expect(describeTally({ shown: 5, selected: 0 }, t)).toBe('5 affichés · 0 sélectionné')
  })

  /**
   * Zero separates the two languages: French agrees "0 sélectionné" in the
   * singular, English says "0 selected". That is exactly what composing by
   * segments preserves, and what a single sentence would lose.
   */
  it('agrees according to the language served', () => {
    expect(describeTally({ shown: 1, selected: 0 }, makeT('en'))).toBe('1 shown · 0 selected')
  })
})

describe('describeEmptyResults', () => {
  it('invites a search while nothing has run', () => {
    expect(
      describeEmptyResults(
        { channel: 'kaliyami', searched: false, running: false, clipsFound: 0, maxViews: null },
        t,
      ),
    ).toBe('Choisis une chaîne et lance la recherche.')
  })

  it('tells apart a period with no clips at all', () => {
    expect(
      describeEmptyResults(
        { channel: 'kaliyami', searched: true, running: false, clipsFound: 0, maxViews: 2 },
        t,
      ),
    ).toContain('n’a aucun clip entre ces deux dates')
  })

  /**
   * A search reports nothing until its first slice comes back, which on a long
   * period takes a minute. Read from that report alone, the table went on
   * inviting a search that was already running — under a block announcing, in
   * so many words, that it was under way.
   */
  it('knows a search is under way before it has reported anything', () => {
    const message = describeEmptyResults(
      { channel: 'kaliyami', searched: false, running: true, clipsFound: 0, maxViews: null },
      t,
    )

    expect(message).toContain('cours')
  })

  // A search runs from a few seconds to several minutes. Concluding "no clips"
  // during that time is false: the first period has not returned yet.
  it('does not conclude clips are absent while the search runs', () => {
    const message = describeEmptyResults(
      { channel: 'kaliyami', searched: true, running: true, clipsFound: 0, maxViews: null },
      t,
    )

    expect(message).not.toContain('aucun clip entre ces deux dates')
    expect(message).not.toContain('Élargis')
    expect(message).toContain('cours')
  })

  // Once clips have been collected, the filter becomes the valid explanation
  // again, search running or not.
  it('still explains the filter while the search runs', () => {
    const message = describeEmptyResults(
      { channel: 'kaliyami', searched: true, running: true, clipsFound: 6, maxViews: 2 },
      t,
    )

    expect(message).toContain('2 vues ou moins')
  })

  it('says how many clips the filter hides, and how to see them', () => {
    const message = describeEmptyResults(
      { channel: 'kaliyami', searched: true, running: false, clipsFound: 6, maxViews: 2 },
      t,
    )

    expect(message).toContain('6 trouvés')
    expect(message).toContain('2 vues')
    expect(message).toContain('2 vues ou moins')
  })

  it('agrees the singular', () => {
    expect(
      describeEmptyResults(
        { channel: 'kaliyami', searched: true, running: false, clipsFound: 1, maxViews: 0 },
        t,
      ),
    ).toContain('1 trouvé')
    expect(
      describeEmptyResults(
        { channel: 'kaliyami', searched: true, running: false, clipsFound: 1, maxViews: 1 },
        t,
      ),
    ).toContain('1 vue')
  })

  /**
   * The last thing typed answers first: a reader who has just written six
   * letters into a search box reads the answer to those six letters.
   */
  it('names the query that empties the table, over the range the search set', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 412,
        maxViews: null,
        period: { from: '2020-01-01', to: '2020-06-30' },
        query: 'zerator',
      },
      t,
    )

    expect(message).toContain('zerator')
    expect(message).toContain('412')
    expect(message).not.toContain('01/01/2020')
  })

  it('ignores a search of nothing but spaces', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 6,
        maxViews: 2,
        query: '  ',
      },
      t,
    )

    expect(message).toContain('2 vues ou moins')
  })

  it('does not mention a threshold when the filter is empty', () => {
    const message = describeEmptyResults(
      { channel: 'kaliyami', searched: true, running: false, clipsFound: 6, maxViews: null },
      t,
    )

    expect(message).not.toContain('Vues max')
  })

  // Dates display in the language's order, never in `yyyy-mm-dd`: that is the
  // pivot format of the fields and the exports, not a way of reading.
  it('names the date range that empties the table', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 412,
        maxViews: null,
        period: { from: '2020-01-01', to: '2020-06-30' },
      },
      t,
    )

    expect(message).toContain('412 clips')
    expect(message).toContain('entre le 01/01/2020 et le 30/06/2020')
    expect(message).toContain('Élargis les dates')
  })

  it('says "from" when only the start bound is set', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 6,
        maxViews: null,
        period: { from: '2021-05-05', to: null },
      },
      t,
    )

    expect(message).toContain('à partir du 05/05/2021')
    expect(message).not.toContain('entre')
  })

  it('says "up to" when only the end bound is set', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 6,
        maxViews: null,
        period: { from: null, to: '2019-01-01' },
      },
      t,
    )

    expect(message).toContain('jusqu’au 01/01/2019')
    expect(message).not.toContain('entre')
  })

  // Two active filters, one cause to name: the range is what the user just
  // narrowed by hand, and it is the one the empty table's action offers to
  // reopen.
  it('names the range rather than the threshold when both are set', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 6,
        maxViews: 2,
        period: { from: '2020-01-01', to: '2020-06-30' },
      },
      t,
    )

    expect(message).toContain('01/01/2020')
    expect(message).not.toContain('Vues max')
  })

  it('stays quiet about dates when no bound is set', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 6,
        maxViews: null,
        period: { from: null, to: null },
      },
      t,
    )

    expect(message).not.toContain('Du / Au')
  })

  // Missing clips outrank the filters: a range set over an empty search explains
  // nothing, it is the period searched that needs widening.
  it('keeps the priority on the "no clip collected" case', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 0,
        maxViews: null,
        period: { from: '2020-01-01', to: '2020-06-30' },
      },
      t,
    )

    expect(message).toContain('n’a aucun clip entre ces deux dates')
  })

  // The English date puts the month first: January and the 1st of the month are
  // indistinguishable on `2020-01-01`, but not on a pair of distinct bounds.
  it('orders dates the way the language served does', () => {
    const message = describeEmptyResults(
      {
        channel: 'kaliyami',
        searched: true,
        running: false,
        clipsFound: 412,
        maxViews: null,
        period: { from: '2020-01-31', to: '2020-06-30' },
      },
      makeT('en'),
    )

    expect(message).toContain('between 01/31/2020 and 06/30/2020')
  })
})

// The one empty table a typo explains: a channel that returned nothing at all.
// Naming it is what lets the reader check the spelling without leaving the page.
describe('describeEmptyResults, on a channel that returned nothing', () => {
  const nothing = (channel: string) =>
    describeEmptyResults(
      { channel, searched: true, running: false, clipsFound: 0, maxViews: null },
      t,
    )

  it('names the channel that was searched', () => {
    expect(nothing('kaliyami')).toContain('kaliyami')
  })

  it('says the same thing whatever the name', () => {
    expect(nothing('zerator')).toContain('zerator')
  })
})
