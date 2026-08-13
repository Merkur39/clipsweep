/**
 * Which of the two readouts is on screen. One at a time, never both: the same
 * clips, shown twice, would cost two virtualisers and a page twice as long for
 * nothing — the selection being shared, there is nothing to compare side by
 * side.
 */
export const VIEWS = ['table', 'grid'] as const

export type View = (typeof VIEWS)[number]

const isView = (value: string): value is View => (VIEWS as readonly string[]).includes(value)

/**
 * The choice lives in localStorage — a display preference, like the theme, not
 * a parameter of a sweep. It is therefore hand-editable and may date from a
 * version that named the views differently: anything unrecognized falls back to
 * the table, the readout the tool is built around and the only one that shows
 * everything without loading a single image.
 */
export function parseView(stored: string | null): View {
  return stored !== null && isView(stored) ? stored : 'table'
}
