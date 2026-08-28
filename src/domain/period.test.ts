import { describe, expect, it } from 'vitest'

import {
  activePreset,
  clampSince,
  clampUntil,
  daysBefore,
  describePeriodError,
  monthsBefore,
  periodPresets,
} from './period'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

describe('monthsBefore', () => {
  it('returns the same day of the month asked for', () => {
    expect(monthsBefore('2026-08-02', 1)).toBe('2026-07-02')
    expect(monthsBefore('2026-08-02', 12)).toBe('2025-08-02')
  })

  it('goes back a year from January', () => {
    expect(monthsBefore('2026-01-15', 1)).toBe('2025-12-15')
  })

  // 31 March minus one month does not exist: `Date`'s natural slide would return
  // 3 March, a date later than the one we started from.
  it('settles on the last day when the target month is shorter', () => {
    expect(monthsBefore('2026-03-31', 1)).toBe('2026-02-28')
    expect(monthsBefore('2026-05-31', 1)).toBe('2026-04-30')
  })

  it('accounts for leap years', () => {
    expect(monthsBefore('2024-03-31', 1)).toBe('2024-02-29')
  })
})

describe('daysBefore', () => {
  it('counts back the days asked for', () => {
    expect(daysBefore('2026-08-27', 30)).toBe('2026-07-28')
  })

  it('crosses a month, a year and a leap day', () => {
    expect(daysBefore('2026-03-05', 10)).toBe('2026-02-23')
    expect(daysBefore('2026-01-05', 10)).toBe('2025-12-26')
    expect(daysBefore('2024-03-05', 10)).toBe('2024-02-24')
  })
})

/**
 * The three shortcuts of the open ticket. They are what a period is chosen with;
 * the two date fields stay available behind "edit", for the one reader in twenty
 * who wants a fortnight in 2023.
 */
describe('periodPresets', () => {
  it('offers the last thirty days, the last twelve months, and everything', () => {
    const presets = periodPresets({ today: '2026-08-27', channelCreatedAt: '2019-04-11' })

    expect(presets).toEqual([
      { id: 'month', since: '2026-07-28', until: '2026-08-27' },
      { id: 'year', since: '2025-08-27', until: '2026-08-27' },
      { id: 'all', since: '2019-04-11', until: '2026-08-27' },
    ])
  })

  /**
   * "Everything" cannot mean "since the channel existed" while the channel is
   * still being typed: it falls back on the day Twitch itself opened, which no
   * clip can predate. `clampSince` pulls it up to the creation date as soon as
   * the lookup lands, so the shortcut never searches years that cannot hold a clip.
   */
  it('falls back on the day Twitch opened while the channel is unknown', () => {
    const presets = periodPresets({ today: '2026-08-27', channelCreatedAt: null })

    expect(presets[2]).toEqual({ id: 'all', since: '2011-06-06', until: '2026-08-27' })
  })
})

describe('activePreset', () => {
  const presets = periodPresets({ today: '2026-08-27', channelCreatedAt: '2019-04-11' })

  it('names the shortcut the period is on', () => {
    expect(activePreset(presets, '2025-08-27', '2026-08-27')).toBe('year')
  })

  // A period typed by hand is nobody's shortcut, and lighting the nearest one
  // would claim a round period the reader never asked for.
  it('names none when the period is neither', () => {
    expect(activePreset(presets, '2026-01-01', '2026-08-27')).toBeNull()
  })

  it('takes both bounds into account', () => {
    expect(activePreset(presets, '2025-08-27', '2026-06-01')).toBeNull()
  })
})

describe('describePeriodError', () => {
  it('says nothing about a valid period', () => {
    expect(describePeriodError('2019-01-01', '2026-08-01', t)).toBeNull()
  })

  // The search bounds the end at 23:59:59: a start and an end on the same day do
  // cover that day.
  it('accepts a single-day period', () => {
    expect(describePeriodError('2026-08-01', '2026-08-01', t)).toBeNull()
  })

  it('reports a start later than the end', () => {
    expect(describePeriodError('2026-08-02', '2026-08-01', t)).toBe(
      'La date de fin est avant la date de début. Inverse les deux.',
    )
  })
})

describe('clampUntil', () => {
  it('leaves the date alone when it precedes today', () => {
    expect(clampUntil('2026-07-01', '2026-08-01')).toBe('2026-07-01')
  })

  // No clip can exist in the future: windows past today would return nothing,
  // spending one request each.
  it('pulls the date back to today when it goes beyond', () => {
    expect(clampUntil('2027-01-01', '2026-08-01')).toBe('2026-08-01')
  })

  it('accepts equality without changing anything', () => {
    expect(clampUntil('2026-08-01', '2026-08-01')).toBe('2026-08-01')
  })

  // Time moves: a date typed too far ahead eventually becomes legitimate, as
  // long as it was not overwritten in the meantime.
  it('does not destroy the input, which becomes valid again when the day comes', () => {
    const typed = '2026-12-31'

    expect(clampUntil(typed, '2026-08-01')).toBe('2026-08-01')
    expect(clampUntil(typed, '2027-03-15')).toBe(typed)
  })
})

describe('clampSince', () => {
  it('leaves the date alone when the channel predates it', () => {
    expect(clampSince('2019-01-01', '2017-07-10')).toBe('2019-01-01')
  })

  // Searching before the channel existed can return nothing, and costs one yearly
  // window — so at least one request — per year too many.
  it('settles the date on the creation when it precedes it', () => {
    expect(clampSince('2015-01-01', '2017-07-10')).toBe('2017-07-10')
  })

  it('accepts equality without changing anything', () => {
    expect(clampSince('2017-07-10', '2017-07-10')).toBe('2017-07-10')
  })

  // As long as the channel has not been resolved, nothing is constrained: the
  // user's input stands.
  it('constrains nothing while the creation date is unknown', () => {
    expect(clampSince('2015-01-01', null)).toBe('2015-01-01')
  })

  // The constraint belongs to the targeted channel, not to the input: going back
  // to an older channel must return its original date.
  it('does not destroy the input, which becomes valid again on an older channel', () => {
    const typed = '2015-01-01'

    expect(clampSince(typed, '2017-07-10')).toBe('2017-07-10')
    expect(clampSince(typed, '2011-06-06')).toBe(typed)
  })
})
