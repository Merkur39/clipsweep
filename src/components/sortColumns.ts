import type { SortKey } from '../domain/sort'
import type { MessageKey } from '../i18n/messages.fr'

/**
 * The four keys one can sort on, and what they are called.
 *
 * Shared by the two readouts' heads so the offer cannot drift between them —
 * their markup, on the other hand, stays their own: the table's columns carry
 * `aria-sort`, which needs a column header to sit on, and the grid has none.
 */
export const SORT_COLUMNS: { key: SortKey; label: MessageKey }[] = [
  { key: 'views', label: 'table.views' },
  { key: 'date', label: 'table.date' },
  { key: 'title', label: 'table.title' },
  { key: 'creator', label: 'table.creator' },
]
