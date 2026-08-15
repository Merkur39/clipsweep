import type { T } from '../i18n/translate'

/**
 * What a multi-select shows on its closed button. A single value is named — it
 * is the most useful thing to display and it fits — anything beyond is counted,
 * because concatenating dozens of creator names would blow up the layout.
 */
export function describeSelection(
  selected: readonly string[],
  labelOf: (value: string) => string,
  t: T,
): string {
  if (selected.length === 0) return t('filters.all')
  if (selected.length === 1) return labelOf(selected[0])
  return t('filters.selectedCount', { n: selected.length })
}

/**
 * What the game filter reads out for an id, on its button as in its list.
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
