import { describe, expect, it } from 'vitest'

import { gridMetrics, gridRange, keepFirstVisible, visibleRange, windowRows } from './virtual'

const base = { rowHeight: 10, viewportHeight: 100, overscan: 2, count: 1000 }

/**
 * The window read as if it were the scroller, which since the readouts lost
 * their own is what it is. One measurement answers both questions: how far the
 * rows have run under the top edge, and how much of the screen they are left.
 */
describe('windowRows', () => {
  it('has scrolled nothing while the rows begin below the top edge', () => {
    expect(windowRows({ top: 300, innerHeight: 900 }).scrollTop).toBe(0)
  })

  it('counts how far the rows have run past the top edge', () => {
    expect(windowRows({ top: -1200, innerHeight: 900 }).scrollTop).toBe(1200)
  })

  /**
   * What sits above the rows is not theirs to draw into. Taking the whole
   * viewport would mount a screenful of tiles nobody can see — the very cost
   * the window exists to avoid, paid on the first screen of every search.
   */
  it('leaves the rows only what the header above them has not taken', () => {
    expect(windowRows({ top: 300, innerHeight: 900 }).viewportHeight).toBe(600)
  })

  it('gives them the whole screen once that header is scrolled away', () => {
    expect(windowRows({ top: -1200, innerHeight: 900 }).viewportHeight).toBe(900)
  })

  /** Wholly below the fold: nothing of them is on screen, and none must mount. */
  it('gives them nothing while they are below the fold', () => {
    expect(windowRows({ top: 1400, innerHeight: 900 }).viewportHeight).toBe(0)
  })
})

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
  const tile = { tileMin: 230, gap: 12, rowGap: 16, metaHeight: 58 }

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
   * 16:9 on the column actually granted, plus the fixed block and the gap. The
   * thumbnail's height comes back out to be applied: leaving it to an
   * `aspect-ratio` would have the browser round a slightly different box, and
   * the half-pixel between the two becomes a visible step down a slice.
   */
  it('derives the row height from the column it computed', () => {
    const { thumbHeight, rowHeight } = gridMetrics({ ...tile, width: 958 })

    // (958 - 3 x 12) / 4 = 230.5 wide, so 130 high.
    expect(thumbHeight).toBe(130)
    // The gap between two rows, which the board sets wider than the one between
    // two columns: a row of images needs more air under it than beside it.
    expect(rowHeight).toBe(130 + 58 + 16)
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

/**
 * Changing density changes the height of a row and the count of tiles in it, so
 * the very same offset comes to name a different clip. Left alone it drops the
 * reader dozens of clips back, in a readout whose whole point is that it is the
 * same page read two ways.
 */
describe('keepFirstVisible', () => {
  // Five columns of 196px, three of 329: at 1960 the tight grid opens on row 10,
  // hence clip 50, which the large one shows on its row 16.
  const tight = { perRow: 5, rowHeight: 196 }
  const large = { perRow: 3, rowHeight: 329 }

  it('brings the row holding that clip to the top', () => {
    expect(keepFirstVisible(1960, tight, large)).toBe(16 * 329)
    expect(keepFirstVisible(16 * 329, large, tight)).toBe(9 * 196)
  })

  /**
   * Five columns do not divide into three: a clip that opened its row in one
   * density lands mid-row in the other, and no offset can put it first without
   * breaking the order being read. Its row is what comes to the top.
   */
  it('settles for the row when the clip cannot open one', () => {
    // Row 2 of the large grid opens on clip 6, which the tight grid draws
    // second in its row 1 — offset 196, not something between two rows.
    expect(keepFirstVisible(2 * 329, large, tight)).toBe(196)
  })

  it('stays at the top when the reader is at the top', () => {
    expect(keepFirstVisible(0, tight, large)).toBe(0)
  })

  // Mid-row: the row that is open is the one that carries the offset, never the
  // next one, or a switch would skip a whole row of clips.
  it('reads the row that is open, not the one being scrolled into', () => {
    expect(keepFirstVisible(195, tight, large)).toBe(0)
    expect(keepFirstVisible(196, tight, large)).toBe(329)
  })

  it('survives a geometry not yet measured', () => {
    expect(keepFirstVisible(500, { perRow: 0, rowHeight: 0 }, large)).toBe(0)
    expect(keepFirstVisible(500, tight, { perRow: 0, rowHeight: 0 })).toBe(0)
  })
})
