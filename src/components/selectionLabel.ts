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
