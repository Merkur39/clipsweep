import { describe, expect, it } from 'vitest'

import { parseView } from './view'

describe('parseView', () => {
  it('keeps a known view', () => {
    expect(parseView('large')).toBe('large')
    expect(parseView('dense')).toBe('dense')
    expect(parseView('list')).toBe('list')
  })

  /**
   * Only one of the two former readouts was ever a choice. `grid` had to be
   * asked for, so it carries over. `table` was the default the tool wrote to
   * storage on first mount, whether or not anyone wanted it — honouring it as a
   * preference would land the whole existing audience on the rows, in a
   * redesign whose entire premise is that they land on the gallery.
   */
  it('carries over the readout that had to be chosen, and only it', () => {
    expect(parseView('grid')).toBe('large')
    expect(parseView('table')).toBe('large')
  })

  /**
   * The choice lives in localStorage, so it is hand-editable and may date from a
   * version that named the views differently. The large gallery is the fallback:
   * it is what the tool opens on, and what a visitor who has expressed nothing
   * should meet.
   */
  it('falls back to the large gallery on anything else', () => {
    expect(parseView('mosaic')).toBe('large')
    expect(parseView('')).toBe('large')
    expect(parseView(null)).toBe('large')
  })
})
