import { describe, expect, it } from 'vitest'

import { describeDayRange, describeViewRange } from './filterLabel'

/** What `formatCount` groups thousands with, once the thin spaces are normalized. */
const NBSP = String.fromCharCode(0x00a0)

describe('describeViewRange', () => {
  it('says nothing while neither threshold is set', () => {
    expect(describeViewRange('', '', 'fr')).toBeNull()
  })

  it('reads a floor alone as a minimum', () => {
    expect(describeViewRange('1000', '', 'fr')).toBe(`≥ 1${NBSP}000`)
  })

  it('reads a ceiling alone as a maximum', () => {
    expect(describeViewRange('', '5000', 'fr')).toBe(`≤ 5${NBSP}000`)
  })

  it('reads the two together as an interval', () => {
    expect(describeViewRange('1000', '5000', 'fr')).toBe(`1${NBSP}000 – 5${NBSP}000`)
  })

  // The chip and the filter read the same field: a summary that announced a
  // threshold `applyFilters` does not apply would name the wrong culprit for an
  // empty table.
  it('ignores what the filter itself would not apply', () => {
    expect(describeViewRange('abc', '', 'fr')).toBeNull()
  })

  it('groups the thousands as the language does', () => {
    expect(describeViewRange('1000', '', 'en')).toBe('≥ 1,000')
  })
})

describe('describeDayRange', () => {
  it('says nothing while no bound is set', () => {
    expect(describeDayRange({ from: '', to: '' }, 'fr')).toBeNull()
  })

  /**
   * A search fills both fields with the period it ran on, and the chip shows
   * that period from then on. It read the range through its narrowing at first,
   * so that a period holding nothing back left the chip a bare word — which
   * hid, after every search, the one thing the chip exists to show.
   */
  it('reads the range the fields hold, narrowing or not', () => {
    expect(describeDayRange({ from: '2024-01-01', to: '2024-12-31' }, 'fr')).toBe(
      '01/01/2024 → 31/12/2024',
    )
  })

  it('leaves the side that is not set open', () => {
    expect(describeDayRange({ from: '2024-03-01', to: '' }, 'fr')).toBe('01/03/2024 →')
    expect(describeDayRange({ from: '', to: '2024-06-30' }, 'fr')).toBe('→ 30/06/2024')
  })

  it('writes the day in the language’s own field order', () => {
    expect(describeDayRange({ from: '2024-03-01', to: '' }, 'en')).toBe('03/01/2024 →')
  })
})
