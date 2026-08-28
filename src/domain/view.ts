/**
 * Which readout is on screen, and how tightly it is packed. One at a time,
 * never two: the same clips, shown twice, would cost two virtualisers and a
 * page twice as long for nothing — the selection being shared, there is nothing
 * to compare side by side.
 *
 * Three, not two, because the tool serves two readers out of one page. Whoever
 * came to look wants images large enough to judge a clip by; whoever came to
 * work through nine hundred of them wants as many on screen as will fit. Two
 * separate products would be the other answer, and a worse one.
 *
 * `grid` keeps its name although `large` is a grid too: it is the value already
 * sitting in the visitors' localStorage, and it still means the same tiles it
 * always did. Renaming it would silently move every one of them to the table.
 */
export const VIEWS = ['large', 'grid', 'table'] as const

export type View = (typeof VIEWS)[number]

/** The readouts made of tiles — the two that have a geometry to settle. */
export const TILE_VIEWS = ['large', 'grid'] as const

export type TileView = (typeof TILE_VIEWS)[number]

export const isTileView = (view: View): view is TileView => view !== 'table'

const isView = (value: string): value is View => (VIEWS as readonly string[]).includes(value)

/**
 * The choice lives in localStorage — a display preference, like the theme, not
 * a parameter of a search. It says how one likes to read clips, not which ones
 * were being read. It is therefore hand-editable and may date from a version
 * that named the views differently: anything unrecognized falls back to the
 * table, the readout the tool is built around and the only one that shows
 * everything without loading a single image.
 */
export function parseView(stored: string | null): View {
  return stored !== null && isView(stored) ? stored : 'table'
}
