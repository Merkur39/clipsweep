import { describe, expect, it } from 'vitest'

import { gridMetrics, gridRange, visibleRange } from './virtual'

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

/**
 * The grid measures what the table declares. A tile stretches to fill the width,
 * so its height is not a constant to write down but a consequence of the column
 * it lands in — and the virtualiser needs that height exactly, since it places
 * rows by multiplying it.
 */
describe('gridMetrics', () => {
  const tile = { tileMin: 230, gap: 12, metaHeight: 58 }

  it('fits as many columns as the width takes, gaps included', () => {
    // 958 = 4 x 230 + 3 x 12 + 34 left over: not enough for a fifth.
    expect(gridMetrics({ ...tile, width: 958 }).perRow).toBe(4)
    // A fifth column costs 5 x 230 + 4 x 12 = 1198, and not one pixel less.
    expect(gridMetrics({ ...tile, width: 1197 }).perRow).toBe(4)
    expect(gridMetrics({ ...tile, width: 1198 }).perRow).toBe(5)
  })

  it('never drops below one column', () => {
    expect(gridMetrics({ ...tile, width: 100 }).perRow).toBe(1)
    // Before the first measurement, and it must still yield a usable row.
    expect(gridMetrics({ ...tile, width: 0 }).perRow).toBe(1)
  })

  /**
   * 16:9 on the column actually granted, plus the fixed block, the hairlines
   * and the gap. The thumbnail's height comes back out to be applied: leaving
   * it to an `aspect-ratio` would have the browser round a slightly different
   * box, and the half-pixel between the two becomes a visible step down a
   * slice.
   */
  it('derives the row height from the column it computed', () => {
    const { thumbHeight, rowHeight } = gridMetrics({ ...tile, width: 958 })

    // (958 - 3 x 12) / 4 = 230.5 of column, less the two hairlines = 228.5 of
    // thumbnail, so 129 high.
    expect(thumbHeight).toBe(129)
    expect(rowHeight).toBe(129 + 2 + 58 + 12)
  })

  /**
   * Under `box-sizing: border-box` the tile's hairlines are taken out of the
   * column, so the thumbnail is never as wide as the track it sits in. Applying
   * the ratio to the column instead put every thumbnail a pixel and a quarter
   * too tall, and a placed row landed beside the tiles it was placed for.
   */
  it('takes the tile hairlines off the column before applying the ratio', () => {
    expect(gridMetrics({ ...tile, width: 958, border: 0 }).thumbHeight).toBe(130)
    expect(gridMetrics({ ...tile, width: 958, border: 1 }).thumbHeight).toBe(129)
  })
})

describe('gridRange', () => {
  const base = { rowHeight: 100, viewportHeight: 400, overscan: 1, perRow: 4, count: 100 }

  it('slices whole rows', () => {
    // Row 5 at the top edge, one row of overscan above: item 16 opens the slice.
    expect(gridRange({ ...base, scrollTop: 500 })).toMatchObject({
      firstIndex: 16,
      endIndex: 40,
    })
  })

  it('places the slice where its first row starts', () => {
    expect(gridRange({ ...base, scrollTop: 500 }).offsetTop).toBe(400)
  })

  it('never runs past the end of the list', () => {
    // 25 rows of 100 under a 400 viewport: the scroll stops at 2100, where the
    // window would otherwise ask for 26 rows, hence 104 tiles.
    expect(gridRange({ ...base, scrollTop: 2100 })).toMatchObject({
      firstIndex: 80,
      endIndex: 100,
    })
  })

  /** A last row that is not full still takes a whole row of height. */
  it('reserves the height of every row, the partial one included', () => {
    expect(gridRange({ ...base, scrollTop: 0, count: 9 }).totalHeight).toBe(300)
    expect(gridRange({ ...base, scrollTop: 0, count: 0 }).totalHeight).toBe(0)
  })
})
