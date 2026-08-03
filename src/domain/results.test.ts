import { describe, expect, it } from 'vitest'

import { describeEmptyResults, describeResultCount, describeSearchStatus } from './results'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

describe('describeSearchStatus', () => {
  it('says nothing while no sweep has run', () => {
    expect(describeSearchStatus({ running: false, progress: null, clipsFound: 0 }, t)).toBeNull()
  })

  it('reports progress while the sweep runs', () => {
    const text = describeSearchStatus(
      {
        running: true,
        progress: { windowsDone: 12, windowsTotal: 40, clipsFound: 340, requests: 55 },
        clipsFound: 0,
      },
      t,
    )

    expect(text).toContain('12')
    expect(text).toContain('40')
    expect(text).toContain('340')
  })

  it('announces the tally once the sweep is done', () => {
    const text = describeSearchStatus(
      {
        running: false,
        progress: { windowsDone: 40, windowsTotal: 40, clipsFound: 412, requests: 90 },
        clipsFound: 412,
      },
      t,
    )

    expect(text).toContain('412')
    expect(text).not.toContain('en cours')
  })

  it('agrees the singular', () => {
    const text = describeSearchStatus(
      {
        running: false,
        progress: { windowsDone: 1, windowsTotal: 1, clipsFound: 1, requests: 1 },
        clipsFound: 1,
      },
      t,
    )

    expect(text).toContain('1 clip ')
    expect(text).not.toContain('1 clips')
  })
})

describe('describeResultCount', () => {
  it('stays quiet while there is nothing to count', () => {
    expect(describeResultCount({ found: 0, shown: 0, selected: 0 }, t)).toBe('')
  })

  // Stable shape: the three numbers always present, easier to read at a glance
  // than a label whose structure changes with the values.
  it('gives the three numbers', () => {
    expect(describeResultCount({ found: 412, shown: 87, selected: 40 }, t)).toBe(
      '412 clips récupérés · 87 affichés · 40 sélectionnés',
    )
  })

  it('agrees each number separately', () => {
    expect(describeResultCount({ found: 1, shown: 1, selected: 1 }, t)).toBe(
      '1 clip récupéré · 1 affiché · 1 sélectionné',
    )
  })

  it('handles an empty selection', () => {
    expect(describeResultCount({ found: 5, shown: 5, selected: 0 }, t)).toBe(
      '5 clips récupérés · 5 affichés · 0 sélectionné',
    )
  })

  /**
   * Zero separates the two languages: French agrees "0 sélectionné" in the
   * singular, English says "0 selected". That is exactly what composing by
   * segments preserves, and what a single sentence would lose.
   */
  it('agrees according to the language served', () => {
    expect(describeResultCount({ found: 1, shown: 1, selected: 0 }, makeT('en'))).toBe(
      '1 clip collected · 1 shown · 0 selected',
    )
  })
})

describe('describeEmptyResults', () => {
  it('invites a sweep while nothing has run', () => {
    expect(
      describeEmptyResults({ searched: false, running: false, clipsFound: 0, maxViews: null }, t),
    ).toBe('Aucun scan lancé.')
  })

  it('tells apart a period with no clips at all', () => {
    expect(
      describeEmptyResults({ searched: true, running: false, clipsFound: 0, maxViews: 2 }, t),
    ).toBe('Aucun clip sur cette période. Élargis l’intervalle de dates.')
  })

  // A sweep runs from a few seconds to several minutes. Concluding "no clips"
  // during that time is false: the first period has not returned yet.
  it('does not conclude clips are absent while the sweep runs', () => {
    const message = describeEmptyResults(
      { searched: true, running: true, clipsFound: 0, maxViews: null },
      t,
    )

    expect(message).not.toContain('Aucun clip sur cette période')
    expect(message).not.toContain('Élargis')
    expect(message).toContain('cours')
  })

  // Once clips have been collected, the filter becomes the valid explanation
  // again, sweep running or not.
  it('still explains the filter while the sweep runs', () => {
    const message = describeEmptyResults(
      { searched: true, running: true, clipsFound: 6, maxViews: 2 },
      t,
    )

    expect(message).toContain('Vues max')
  })

  it('says how many clips the filter hides, and how to see them', () => {
    const message = describeEmptyResults(
      { searched: true, running: false, clipsFound: 6, maxViews: 2 },
      t,
    )

    expect(message).toContain('6 clips')
    expect(message).toContain('2 vues')
    expect(message).toContain('Vues max')
  })

  it('agrees the singular', () => {
    expect(
      describeEmptyResults({ searched: true, running: false, clipsFound: 1, maxViews: 0 }, t),
    ).toContain('1 clip ')
    expect(
      describeEmptyResults({ searched: true, running: false, clipsFound: 1, maxViews: 1 }, t),
    ).toContain('1 vue')
  })

  it('does not mention a threshold when the filter is empty', () => {
    const message = describeEmptyResults(
      { searched: true, running: false, clipsFound: 6, maxViews: null },
      t,
    )

    expect(message).not.toContain('Vues max')
  })

  // Dates display in the language's order, never in `yyyy-mm-dd`: that is the
  // pivot format of the fields and the exports, not a way of reading.
  it('names the date range that empties the table', () => {
    const message = describeEmptyResults(
      {
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
    expect(message).toContain('Du / Au')
  })

  it('says "from" when only the start bound is set', () => {
    const message = describeEmptyResults(
      {
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

  // Missing clips outrank the filters: a range set over an empty sweep explains
  // nothing, it is the period swept that needs widening.
  it('keeps the priority on the "no clip collected" case', () => {
    const message = describeEmptyResults(
      {
        searched: true,
        running: false,
        clipsFound: 0,
        maxViews: null,
        period: { from: '2020-01-01', to: '2020-06-30' },
      },
      t,
    )

    expect(message).toBe('Aucun clip sur cette période. Élargis l’intervalle de dates.')
  })

  // The English date puts the month first: January and the 1st of the month are
  // indistinguishable on `2020-01-01`, but not on a pair of distinct bounds.
  it('orders dates the way the language served does', () => {
    const message = describeEmptyResults(
      {
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
