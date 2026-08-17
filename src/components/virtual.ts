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
   * The fixed block under the thumbnail — the title box, then the readout line,
   * their margins included — and nothing else. The hairlines used to be counted
   * in here; they are `border` below, because they cost width before they cost
   * height and only one of the two figures can say so.
   */
  metaHeight: number
  /**
   * One of the tile's hairlines, in pixels. Default 1, which is what every tile
   * in this application draws.
   */
  border?: number
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
 * to the sheet's `aspect-ratio` alone, the browser rounds its own box and this
 * rounds another, half a pixel away — which a slice of five rows turns into a
 * visible step. One height, computed once, drawn as computed.
 *
 * And it is 16:9 of the **inner** width, not of the column. Under
 * `box-sizing: border-box` the tile's two hairlines come off the column before
 * anything is drawn inside it, so a 190px tile hands its thumbnail 188px: the
 * ratio applied to the column overstated every thumbnail by a pixel and a
 * quarter, and the drift accumulated down the placed rows. The same two
 * hairlines are added back to the row, which is a border-box figure again.
 */
export function gridMetrics({ width, tileMin, gap, metaHeight, border = 1 }: GridMetricsInput): {
  perRow: number
  thumbHeight: number
  rowHeight: number
} {
  // `tileMin` and the column are border-box widths, like the tiles themselves:
  // the hairlines are inside them, and the gaps are what sits between.
  const perRow = Math.max(1, Math.floor((width + gap) / (tileMin + gap)))
  const columnWidth = Math.max(0, (width - gap * (perRow - 1)) / perRow)
  const innerWidth = Math.max(0, columnWidth - border * 2)
  const thumbHeight = Math.round((innerWidth * 9) / 16)

  return { perRow, thumbHeight, rowHeight: thumbHeight + border * 2 + metaHeight + gap }
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
