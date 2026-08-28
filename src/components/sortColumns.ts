import type { SortKey } from '../domain/sort'
import type { MessageKey } from '../i18n/messages.fr'

export interface ReadoutColumn {
  /** The track it occupies in `table.css`, and the class its cells carry. */
  className: string
  label: MessageKey
  /** Present when the head orders on it; absent when the column only reads. */
  key?: SortKey
}

/**
 * The list's columns, in the order it draws them.
 *
 * The title first and widest: it is what a clip is recognised by, and every
 * other column is a fact about it. The counts and the dates that used to open
 * the row were there because the tool was a search report; it is a readout now,
 * and a readout leads with the thing itself.
 *
 * The game is drawn without a key. Ordering on it would group, and grouping is
 * what its filter chip already does — better, since it drops everything else at
 * the same time. See `SORT_KEYS` for the second reason.
 */
export const COLUMNS: ReadoutColumn[] = [
  { className: 'col-title', label: 'table.title', key: 'title' },
  { className: 'col-views', label: 'table.views', key: 'views' },
  { className: 'col-author', label: 'table.creator', key: 'creator' },
  { className: 'col-game', label: 'table.game' },
  { className: 'col-date', label: 'table.date', key: 'date' },
  { className: 'col-length', label: 'table.duration', key: 'duration' },
]

/**
 * What the grid's strip offers: the columns the list orders on, in the list's
 * own order.
 *
 * Derived rather than restated, so the two readouts cannot come to offer
 * different keys — their markup stays their own, the table's columns carrying
 * an `aria-sort` that needs a column header to sit on, which the grid has none
 * of.
 */
export const SORT_COLUMNS = COLUMNS.filter(
  (column): column is ReadoutColumn & { key: SortKey } => column.key !== undefined,
)
