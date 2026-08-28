import type { Clip } from '../twitch/types'

/**
 * The seven columns an export carries, in the order they are read.
 *
 * Not the whole payload: a thumbnail URL and an embed URL are addresses this
 * application uses to draw a page, and they say nothing in a spreadsheet. What
 * is left is what a clip IS — where it lives, what it is called, how it did.
 */
const CSV_COLUMNS = [
  'id',
  'url',
  'title',
  'view_count',
  'created_at',
  'creator_name',
  'duration',
] as const

/**
 * The selection as a spreadsheet.
 *
 * Every cell is quoted, whatever it holds: a title is the one column written by
 * hand, so a comma in it would open a column that is not there, and a quote
 * would close a cell that is not finished. Doubling the quote is what the
 * format asks for, and quoting everything means the rule is applied in one
 * place rather than decided per cell.
 */
export function toCsv(clips: readonly Clip[]): string {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = clips.map((clip) => CSV_COLUMNS.map((column) => cell(clip[column])).join(','))
  // Leading BOM so Excel picks up UTF-8.
  return '\uFEFF' + [CSV_COLUMNS.join(','), ...rows].join('\n')
}
