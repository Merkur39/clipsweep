import { describe, expect, it } from 'vitest'

import { formatDuration } from './format'

/**
 * The one reading that takes no language: `m:ss` has the same order and the
 * same separator everywhere, unlike a count or a date. Passing a locale here
 * would suggest a choice that does not exist.
 */
describe('formatDuration', () => {
  it('reads a clip in minutes and seconds', () => {
    expect(formatDuration(31)).toBe('0:31')
    expect(formatDuration(65)).toBe('1:05')
  })

  it('pads the seconds so the badge keeps its width', () => {
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(0)).toBe('0:00')
  })

  // Helix serves the duration as a float: 59.6 s is a minute, not 59.
  it('rounds what the API serves as a float', () => {
    expect(formatDuration(30.4)).toBe('0:30')
    expect(formatDuration(59.6)).toBe('1:00')
  })
})

import { formatCount, formatDay } from './format'

describe('formatCount', () => {
  it('leaves small numbers untouched', () => {
    expect(formatCount(0, 'fr')).toBe('0')
    expect(formatCount(999, 'en')).toBe('999')
  })

  it('groups thousands according to the language', () => {
    expect(formatCount(1234567, 'en')).toBe('1,234,567')
    expect(formatCount(412, 'fr')).toBe('412')
  })

  it('groups every slice', () => {
    const nbsp = String.fromCharCode(0x00a0)

    expect(formatCount(1000, 'fr')).toBe(`1${nbsp}000`)
    expect(formatCount(20000, 'fr')).toBe(`20${nbsp}000`)
  })

  // A breaking space would split the column at the end of a line.
  it('uses no breaking space', () => {
    expect(formatCount(1234567, 'fr')).not.toContain(' ')
  })

  /**
   * `Intl` separates the groups with a **narrow** no-break space in fr-FR, which
   * several monospace fonts lack: it then falls back to a glyph of a different
   * width and knocks the views column out of alignment, the very thing
   * `tabular-nums` had just made comparable.
   */
  it('normalizes the French narrow space into an ordinary no-break space', () => {
    const formatted = formatCount(1234567, 'fr')

    expect(formatted).toBe(`1${String.fromCharCode(0x00a0)}234${String.fromCharCode(0x00a0)}567`)
    expect(formatted).not.toMatch(new RegExp(`[${String.fromCharCode(0x202f, 0x2009)}]`))
  })
})

describe('formatDay', () => {
  it('renders the day in the language’s order', () => {
    expect(formatDay('2026-08-03', 'fr')).toBe('03/08/2026')
    expect(formatDay('2026-08-03', 'en')).toBe('08/03/2026')
  })

  // The search bounds, `created_at` and the windows arrive sometimes as a bare
  // day, sometimes as a full timestamp.
  it('accepts a full timestamp like a bare day', () => {
    expect(formatDay('2026-08-03T22:41:07Z', 'fr')).toBe('03/08/2026')
  })

  /**
   * Everything else in the tool reasons in UTC — the bounds sent to Helix, the
   * fields' default value, the window seeding. Formatting in local time would
   * shift the display by one day west of Greenwich, and the day displayed would
   * no longer be the one the filters compare against.
   */
  it('stays in UTC whatever the machine’s timezone', () => {
    // Midnight UTC: that is the previous evening across the Americas.
    expect(formatDay('2026-08-03T00:00:00Z', 'fr')).toBe('03/08/2026')
  })

  // Fixed width in both languages: the date column is aligned with
  // `tabular-nums`, and an `8/3/26` would make it breathe from row to row.
  it('gives the same width in both languages', () => {
    expect(formatDay('2026-08-03', 'en')).toHaveLength(formatDay('2026-08-03', 'fr').length)
  })
})
