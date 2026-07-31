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
