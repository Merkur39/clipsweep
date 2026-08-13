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

export interface GridMetricsInput {
  /** Content width of the scroller, padding and scrollbar already taken out. */
  width: number
  /** The narrowest a tile is allowed to be; the count of columns follows. */
  tileMin: number
  gap: number
  /**
   * The fixed block under the thumbnail — title, then the readout line — and
   * the tile's two hairlines with it. Everything, in short, that the width does
   * not decide.
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
export function gridMetrics({ width, tileMin, gap, metaHeight }: GridMetricsInput): {
  perRow: number
  thumbHeight: number
  rowHeight: number
} {
  const perRow = Math.max(1, Math.floor((width + gap) / (tileMin + gap)))
  const columnWidth = Math.max(0, (width - gap * (perRow - 1)) / perRow)
  const thumbHeight = Math.round((columnWidth * 9) / 16)

  return { perRow, thumbHeight, rowHeight: thumbHeight + metaHeight + gap }
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
