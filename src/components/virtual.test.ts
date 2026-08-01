import { describe, expect, it } from 'vitest'

import { visibleRange } from './virtual'

const base = { rowHeight: 10, viewportHeight: 100, overscan: 2, count: 1000 }

describe('visibleRange', () => {
  it('starts at the first row when scrolled to the top', () => {
    expect(visibleRange({ ...base, scrollTop: 0 })).toEqual({ firstIndex: 0, endIndex: 14 })
  })

  it('applies the overscan on both sides once scrolled', () => {
    // 500px / 10px = row 50 at the top edge, 10 rows visible.
    expect(visibleRange({ ...base, scrollTop: 500 })).toEqual({ firstIndex: 48, endIndex: 62 })
  })

  it('never runs past the end of the list', () => {
    expect(visibleRange({ ...base, scrollTop: 9_900, count: 1000 })).toEqual({
      firstIndex: 988,
      endIndex: 1000,
    })
  })

  it('renders everything when the list is shorter than the viewport', () => {
    expect(visibleRange({ ...base, scrollTop: 0, count: 4 })).toEqual({
      firstIndex: 0,
      endIndex: 4,
    })
  })

  it('handles an empty list', () => {
    expect(visibleRange({ ...base, scrollTop: 0, count: 0 })).toEqual({
      firstIndex: 0,
      endIndex: 0,
    })
  })
})
