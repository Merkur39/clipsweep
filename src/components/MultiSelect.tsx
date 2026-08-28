import { useCallback, useEffect, useRef, useState } from 'react'

import type { Facet } from '../domain/filters'
import { formatCount } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import { FilterChip } from './FilterChip'
import { describeSelection } from './selectionLabel'
import { visibleRange } from './virtual'

/**
 * The height of an option, applied rather than assumed — the same pact as the
 * table's rows: the window places at this pitch and the sheet must draw at it,
 * or the options would land beside the space reserved for them.
 *
 * It is the height `filters.css` already drew of its own accord, measured at
 * 32.05px and pinned here at 32: the list keeps the density it had, and the
 * fraction that used to accumulate row after row is gone.
 */
const OPTION_HEIGHT = 32
const OVERSCAN = 6
/** The panel's own cap, standing in until the list has been measured. */
const INITIAL_HEIGHT = 280

export interface MultiSelectProps {
  label: string
  options: Facet[]
  selected: readonly string[]
  onChange: (next: string[]) => void
  /** Maps a stored value to what the user reads — game ids to game names. */
  labelOf?: (value: string) => string
}

/**
 * A facet, worn as a chip: the values checked read on the chip itself, the
 * catalogue behind it in the panel it opens.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  labelOf = (value) => value,
}: MultiSelectProps) {
  const { locale, t } = useTranslation()
  // A mirror of the chip's own state: what the list is measured against. The
  // panel is mounted only while open, so the observer has to be re-attached at
  // each opening rather than set once.
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(INITIAL_HEIGHT)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height))
    observer.observe(list)
    return () => observer.disconnect()
  }, [open])

  const onScroll = useCallback(() => setScrollTop(listRef.current?.scrollTop ?? 0), [])

  // Closing throws the list away, and a fresh one opens at the top: the window
  // is brought back with it, or it would draw the options from where we left
  // off against a scroller sitting at zero.
  const onOpenChange = (next: boolean) => {
    setScrollTop(0)
    setOpen(next)
  }

  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((kept) => kept !== value) : [...selected, value],
    )

  const { firstIndex, endIndex } = visibleRange({
    scrollTop,
    viewportHeight,
    rowHeight: OPTION_HEIGHT,
    overscan: OVERSCAN,
    count: options.length,
  })

  return (
    <FilterChip
      label={label}
      value={describeSelection(selected, labelOf, t)}
      disabled={options.length === 0}
      onOpenChange={onOpenChange}
    >
      {selected.length > 0 && (
        <button type="button" className="link" onClick={() => onChange([])}>
          {t('filters.uncheckAll')}
        </button>
      )}
      {/* Windowed, like the results: a search over a busy channel yields
          hundreds of creators, and the two panels together would mount as
          many rows again as the table itself. */}
      <div className="multiselect-options" ref={listRef} onScroll={onScroll}>
        <div style={{ height: options.length * OPTION_HEIGHT, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: firstIndex * OPTION_HEIGHT,
              left: 0,
              right: 0,
            }}
          >
            {options.slice(firstIndex, endIndex).map((option) => (
              <label
                key={option.value}
                /* Spent by the other filters: drawn back, never disabled —
                   a checked value can fall to zero, and this panel is the
                   only place it can be unchecked from. */
                className={
                  option.count === 0 ? 'multiselect-option is-spent' : 'multiselect-option'
                }
                style={{ height: OPTION_HEIGHT }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                {/* The column ellipsises anything past 149px — a game's
                    full title, or the id an unresolved category is named
                    by. The attribute is what puts it back within reach. */}
                <span className="multiselect-option-name" title={labelOf(option.value)}>
                  {labelOf(option.value)}
                </span>
                <span className="multiselect-option-count">
                  {formatCount(option.count, locale)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </FilterChip>
  )
}
