import { describe, expect, it } from 'vitest'

import { isTileView, parseView, VIEWS } from './view'

describe('parseView', () => {
  it('keeps a known view', () => {
    expect(parseView('large')).toBe('large')
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

  // A visitor who chose the thumbnails before the third density existed keeps
  // the very tiles they chose; renaming the value would have moved them to the
  // table without a word.
  it('leaves the stored thumbnails on the thumbnails', () => {
    expect(VIEWS).toContain('grid')
  })
})

describe('isTileView', () => {
  it('tells the readouts made of tiles from the one made of rows', () => {
    expect(isTileView('large')).toBe(true)
    expect(isTileView('grid')).toBe(true)
    expect(isTileView('table')).toBe(false)
  })
})
