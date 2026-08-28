export interface VisibleRangeInput {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  overscan: number
  count: number
}

/** Half-open slice `[firstIndex, endIndex)` of rows worth mounting. */
export function visibleRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  overscan,
  count,
}: VisibleRangeInput): { firstIndex: number; endIndex: number } {
  const firstIndex = Math.max(0, Math.min(count, Math.floor(scrollTop / rowHeight) - overscan))
  const rows = Math.ceil(viewportHeight / rowHeight) + overscan * 2
  return { firstIndex, endIndex: Math.min(count, firstIndex + rows) }
}

export interface WindowRowsInput {
  /**
   * Where the rows begin, measured from the top edge of the viewport — exactly
   * what `getBoundingClientRect` gives. Negative once they have run past it.
   */
  top: number
  /** The viewport's own height. */
  innerHeight: number
}

/**
 * The window, read as the scroller the readouts no longer have.
 *
 * Both readouts used to scroll inside a box of their own, which made these two
 * figures a `scrollTop` and a `clientHeight` to read off one element. Flowing in
 * the page, they are a consequence of where the rows sit on screen: one rect
 * answers both, and there is nothing to keep in sync with the browser's own
 * scroll.
 *
 * The visible height is the screen **less whatever still sits above the rows**.
 * Handing them the whole viewport would mount a screenful of tiles that the
 * ticket and the toolbar are covering — the very cost the window exists to
 * avoid, paid on the first screen of every search.
 */
export function windowRows({ top, innerHeight }: WindowRowsInput): {
  scrollTop: number
  viewportHeight: number
} {
  return {
    scrollTop: Math.max(0, -top),
    viewportHeight: Math.max(0, innerHeight - Math.max(0, top)),
  }
}

export interface GridMetricsInput {
  /** Content width of the scroller, padding and scrollbar already taken out. */
  width: number
  /** The narrowest a tile is allowed to be; the count of columns follows. */
  tileMin: number
  /** Between two tiles of the same row, and the only gap the columns are cut by. */
  gap: number
  /** Between two rows, which the board sets wider — see `TILE_GEOMETRY`. */
  rowGap: number
  /**
   * The fixed block under the thumbnail — title, then the readout line.
   * Everything, in short, that the width does not decide.
   */
  metaHeight: number
}

/**
 * How many columns fit, how tall a thumbnail is in one, and the row they make.
 *
 * The count of columns is computed here rather than left to `auto-fill`,
 * because the virtualiser and the sheet must agree to the column: were they to
 * disagree by one, the placed rows would land beside the drawn ones and the
 * screen would jump on every scroll.
 *
 * `thumbHeight` is returned to be **applied**, not merely to be assumed. Left
 * to an `aspect-ratio` in the sheet, the drawn height is 16:9 of a content box
 * — the column less its two hairlines — and rounded by the browser, where this
 * is 16:9 of the column and rounded here: half a pixel apart, which a slice of
 * five rows turns into a visible step. One height, computed once, drawn as
 * computed.
 */
export function gridMetrics({ width, tileMin, gap, rowGap, metaHeight }: GridMetricsInput): {
  perRow: number
  thumbHeight: number
  rowHeight: number
} {
  const perRow = Math.max(1, Math.floor((width + gap) / (tileMin + gap)))
  const columnWidth = Math.max(0, (width - gap * (perRow - 1)) / perRow)
  const thumbHeight = Math.round((columnWidth * 9) / 16)

  return { perRow, thumbHeight, rowHeight: thumbHeight + metaHeight + rowGap }
}

export interface GridRangeInput extends VisibleRangeInput {
  perRow: number
}

/**
 * The same window, counted in tiles: rows are what scrolls, tiles are what
 * mounts. The slice always opens on a row boundary, so a partly visible row is
 * mounted whole rather than cut down its middle.
 */
export function gridRange({ perRow, count, ...input }: GridRangeInput): {
  firstIndex: number
  endIndex: number
  offsetTop: number
  totalHeight: number
} {
  const rowCount = Math.ceil(count / perRow)
  const rows = visibleRange({ ...input, count: rowCount })

  return {
    firstIndex: rows.firstIndex * perRow,
    endIndex: Math.min(count, rows.endIndex * perRow),
    offsetTop: rows.firstIndex * input.rowHeight,
    totalHeight: rowCount * input.rowHeight,
  }
}

export interface GridPlacement {
  perRow: number
  rowHeight: number
}

/**
 * The scroll offset that brings the row holding the clip at the top of the view
 * to the top of the view, across a change of density.
 *
 * A row is neither as tall nor as wide from one density to the other, so the
 * same offset comes to name a different clip: switching at clip 50 in the tight
 * grid would land on clip 15 in the large one. The offset is therefore read
 * back into a clip through the geometry that drew it, and written forward
 * through the one about to draw it.
 *
 * The **row**, and not the clip: five columns do not divide into three, so a
 * clip that opened its row in one density lands mid-row in the other, and no
 * offset can put it first without breaking the order the reader is sorting by.
 * Its row at the top is the whole of what can be promised, and it is enough —
 * what the reader was looking at is still on screen, within one row's reach.
 *
 * Rounded down twice, deliberately: the row that carries the offset is the one
 * that is open, and the clip that opens it is the one to keep — rounding up
 * would skip a whole row on every switch.
 */
export function keepFirstVisible(
  scrollTop: number,
  before: GridPlacement,
  after: GridPlacement,
): number {
  // Before the first measurement there is no row to read, and no row to write
  // to: the top is the only honest answer.
  if (before.rowHeight <= 0 || after.perRow <= 0) return 0

  const firstClip = Math.floor(scrollTop / before.rowHeight) * before.perRow
  return Math.floor(firstClip / after.perRow) * after.rowHeight
}
