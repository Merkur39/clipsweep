import type { T } from '../i18n/translate'

/**
 * What a facet chip reads after its label — or null, which is what keeps the
 * chip a bare word while nothing is checked.
 *
 * A single value is named: it is the most useful thing to show and it fits.
 * Anything beyond is counted, because concatenating dozens of creator names
 * would blow up a row the readout is not giving any more of.
 *
 * Nothing checked used to read "All", when the control was a field whose value
 * slot had to hold something. A chip has no such slot: the filter is off, and
 * saying so in a word would be one word claiming to be a value.
 */
export function describeSelection(
  selected: readonly string[],
  labelOf: (value: string) => string,
  t: T,
): string | null {
  if (selected.length === 0) return null
  if (selected.length === 1) return labelOf(selected[0])
  return t('filters.selectedCount', { n: selected.length })
}

/**
 * What the game filter reads out for an id, on its chip as in its list.
 *
 * Helix returns ids and names them on demand, but not all of them: a category
 * it has retired comes back from `/games` with no row, and the id is all that
 * is left. Showing that number bare passes for a fault in the tool — naming it
 * a category says what it is, and keeps the number, which is the only handle
 * left on a category that has lost its name.
 */
export function gameLabeller(names: ReadonlyMap<string, string>, t: T): (id: string) => string {
  return (id) => names.get(id) ?? t('filters.unknownGame', { id })
}
