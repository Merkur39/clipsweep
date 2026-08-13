import { describe, expect, it } from 'vitest'

import { parseView } from './view'

describe('parseView', () => {
  it('keeps a known view', () => {
    expect(parseView('grid')).toBe('grid')
    expect(parseView('table')).toBe('table')
  })

  /**
   * The choice lives in localStorage, so it is hand-editable and may date from a
   * version that named the views differently. The table is the fallback: it is
   * the readout the tool is built around, and the one that shows everything
   * without loading a single image.
   */
  it('falls back to the table on anything else', () => {
    expect(parseView('mosaic')).toBe('table')
    expect(parseView('')).toBe('table')
    expect(parseView(null)).toBe('table')
  })
})
