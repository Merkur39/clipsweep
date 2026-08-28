import type { TileView } from '../domain/view'

export interface TileGeometry {
  /** The narrowest a tile may be; the count of columns follows from it. */
  tileMin: number
  /** Between two tiles of a row, and the only gap the columns are cut by. */
  gap: number
  /**
   * Between two rows, and wider than the one between two columns: a tile ends
   * in two lines of type, and the next row opens on an image. Too little air
   * there and the readout line reads as a caption for the picture below it.
   */
  rowGap: number
  /**
   * The fixed block under the thumbnail — the air above the title, the title,
   * the air above the readout line, the readout line. Everything, in short,
   * that the width does not decide.
   */
  metaHeight: number
}

/**
 * The two tile densities, in the one place both the virtualiser and the sheet
 * answer to.
 *
 * ⚠️ `metaHeight` is a contract held in two places on purpose: this file
 * multiplies it to place rows, `clip-grid.css` draws the block it measures, and
 * neither can check the other at runtime — jsdom has no layout. What checks it
 * is `scripts/geometry/tile.test.ts`, which reads both sources and adds up.
 * **Never change one without the other**, and never move this file away from
 * that sheet.
 *
 * Neither gap is such a contract, and deliberately: they used to be written
 * both here and in the sheet, so they are now applied inline on `.grid-rows`
 * from this very object. One less thing that can drift.
 *
 * The two `tileMin` are chosen for what they yield across the readout at its
 * full width — three columns and five — but they are minimums, not counts: a
 * narrow window drops a column of its own accord rather than shrinking tiles
 * past what an image needs to be judged by.
 */
export const TILE_GEOMETRY: Record<TileView, TileGeometry> = {
  large: { tileMin: 400, gap: 20, rowGap: 24, metaHeight: 76 },
  grid: { tileMin: 230, gap: 14, rowGap: 18, metaHeight: 45 },
}
