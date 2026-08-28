import type { ClipSort, SortKey } from '../domain/sort'
import { useTranslation } from '../i18n/LocaleProvider'
import { FilterChip } from './FilterChip'
import { CaretIcon } from './Icon'
import { SORT_COLUMNS } from './sortColumns'

export interface SortChipProps {
  sort: ClipSort
  onChange: (key: SortKey) => void
}

/**
 * The order, worn as a chip beside the filters.
 *
 * It is what gives the tile grids an order at all: a board of images has no
 * column heads to click, and the strip of keys that used to run above it was a
 * second sorting vocabulary for the same page. The list keeps its heads — a
 * column is where `aria-sort` belongs, and clicking the thing itself is more
 * direct than opening a panel about it — so on that screen the two agree rather
 * than compete.
 *
 * It never wears the accent, unlike the chips beside it: there, colour means a
 * filter is holding something back. An order is always in force, and a chip lit
 * at all times says nothing at all.
 */
export function SortChip({ sort, onChange }: SortChipProps) {
  const { t } = useTranslation()
  const current = SORT_COLUMNS.find((column) => column.key === sort.key)
  const turn = sort.direction === 'asc' ? 0 : 180

  return (
    <FilterChip
      label={t('sort.label')}
      active={false}
      value={
        current && (
          <>
            {/* Wrapped so the sheet can drop it on a phone and keep the caret:
                a toolbar of five controls has no room for the key it sorts on,
                and the panel says it the moment it opens. */}
            <span className="sort-value">{t(current.label)}</span>
            <CaretIcon turn={turn} />
          </>
        )
      }
    >
      {/* Left open on a choice: turning an order round is a second click on the
          same key, and a panel that shut would make the reader open it again to
          do the very thing they were most likely to do next. */}
      <div className="sort-options">
        {SORT_COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            className="sort-option"
            aria-pressed={sort.key === column.key}
            onClick={() => onChange(column.key)}
          >
            {t(column.label)}
            <span aria-hidden="true" className="sort-key-arrow">
              {sort.key === column.key && <CaretIcon turn={turn} />}
            </span>
          </button>
        ))}
      </div>
    </FilterChip>
  )
}
