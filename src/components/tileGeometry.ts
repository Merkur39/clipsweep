import type { GridMetricsInput } from './virtual'

/**
 * The two densities the gallery is drawn at, as the three figures `gridMetrics`
 * needs. One gallery, one set of tiles, one order, one selection: what changes
 * between them is how many fit across and how much each says.
 *
 * `metaHeight` is the block under the thumbnail — everything the width does not
 * decide — and it is a **contract with `clip-grid.css`**. The tile has no frame,
 * so no hairline enters it any more.
 * The large tile carries two lines of title and one readout; the tight one adds
 * the date and the game beneath. Change a rule in the sheet without changing
 * the figure here and the placed rows land beside the drawn ones.
 */
type TileGeometry = Omit<GridMetricsInput, 'width'>

/* 6 + 44 (two lines of title at 22) + 17 (the readout) + 5. No hairlines enter
   it: the tile has no frame. */
const LARGE: TileGeometry = { tileMin: 340, gap: 24, metaHeight: 72 }
/* 6 + 34 (the title drops to 13/17) + 17 + 17 + 5: one readout more, and a
   shorter title, which do not cancel out. */
const DENSE: TileGeometry = { tileMin: 230, gap: 16, metaHeight: 79 }

/**
 * Below this the stage is a phone held upright, and the tight gallery lowers
 * its minimum to stay two columns.
 */
const NARROW = 640
const DENSE_NARROW: TileGeometry = { ...DENSE, tileMin: 150, gap: 10 }

/**
 * A phone's idea of tight is not a desktop's. Holding 230 on a 390-wide screen
 * leaves room for exactly one column — which is the large gallery — and the
 * density control would then have two of its three states drawing the same
 * thing. The large gallery needs no such exception: one column on a phone is
 * what it is for.
 */
export function tileGeometry(dense: boolean, width: number): TileGeometry {
  if (!dense) return LARGE
  return width < NARROW ? DENSE_NARROW : DENSE
}
