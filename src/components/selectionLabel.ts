/**
 * What a multi-select shows on its closed button. A single value is named — it
 * is the most useful thing to display and it fits — anything beyond is counted,
 * because concatenating dozens of creator names would blow up the layout.
 */
export function describeSelection(
  selected: readonly string[],
  labelOf: (value: string) => string,
): string {
  if (selected.length === 0) return 'Tous'
  if (selected.length === 1) return labelOf(selected[0])
  return `${selected.length} sélectionnés`
}
