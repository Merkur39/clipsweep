/**
 * Which readout is on screen, and at which density. One at a time, never two:
 * the same clips, shown twice, would cost two virtualisers and a page twice as
 * long for nothing — the selection being shared, there is nothing to compare
 * side by side.
 *
 * `large` and `dense` are the same gallery at two densities, not two designs:
 * same cards, same order, same selection. What changes is the column count and
 * how much metadata each card carries — the curious open on `large`, whoever
 * is working through a sweep opens on `dense`. `list` is the rows, for the
 * numbers.
 */
export const VIEWS = ['large', 'dense', 'list'] as const

export type View = (typeof VIEWS)[number]

const isView = (value: string): value is View => (VIEWS as readonly string[]).includes(value)

/**
 * What the readout the tool shipped with becomes — the one that was ever a
 * choice. `grid` had to be asked for, so whoever has it wanted the thumbnails
 * and gets the gallery.
 *
 * `table` is deliberately absent. It was the old default, written to storage on
 * first mount whether or not anyone wanted it, so a stored `table` cannot be
 * told apart from never having chosen at all. Reading it as a preference would
 * land the whole existing audience on the rows, in a redesign whose premise is
 * that they land on the gallery. It falls through to the default like any other
 * unknown value — which is the gallery.
 */
const FORMER: Record<string, View> = { grid: 'large' }

/**
 * The choice lives in localStorage — a display preference, like the theme, not
 * a parameter of a sweep. It is therefore hand-editable and may date from a
 * version that named the views differently: anything unrecognized falls back to
 * the large gallery, which is what the tool opens on.
 */
export function parseView(stored: string | null): View {
  if (stored === null) return 'large'
  if (isView(stored)) return stored
  return FORMER[stored] ?? 'large'
}
