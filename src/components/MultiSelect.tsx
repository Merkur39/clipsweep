import { useCallback, useEffect, useRef, useState } from 'react'

import type { Facet } from '../domain/filters'
import { formatCount } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import { Icon } from './Icon'
import { visibleRange } from './virtual'

/**
 * The height of an option, applied rather than assumed — the same pact as the
 * table's rows: the window places at this pitch and the sheet must draw at it,
 * or the options would land beside the space reserved for them.
 *
 * Its counterpart is `--opt-row` in `base.css`, at the same 32px. Change one,
 * change the other.
 */
const OPTION_HEIGHT = 32
const OVERSCAN = 6
/**
 * The cap `.opts` holds — seven options — standing in until the list has been
 * measured. Wrong by a row or two on the first frame costs a handful of extra
 * options mounted; wrong by a factor would leave a scrolled panel blank.
 */
const INITIAL_HEIGHT = OPTION_HEIGHT * 7

export interface MultiSelectProps {
  /** The panel's own id: what the pill's `aria-controls` points at. */
  id: string
  /** The facet's name. The pill carries it too; here it names the panel. */
  label: string
  options: Facet[]
  selected: readonly string[]
  onChange: (next: string[]) => void
  /** Maps a stored value to what the user reads — game ids to game names. */
  labelOf?: (value: string) => string
}

/**
 * The name of an option and, when Helix could never resolve it, the id that
 * stands in for the name.
 *
 * `filters.unknownGame` writes that id in brackets at the end of the label, and
 * the panel draws it in the secondary ink: a number doing a name's work must
 * not read as a name. The split is decided on the **value**, never on the mere
 * presence of brackets — a label only surrenders its tail when that tail is
 * literally the option's own id, which no game title can be.
 */
function splitUnresolved(value: string, label: string): { name: string; id: string | null } {
  const tail = `(${value})`
  if (!label.endsWith(tail)) return { name: label, id: null }

  return { name: label.slice(0, label.length - tail.length), id: tail }
}

/**
 * What a facet pill opens: every value the sweep turned up, each with the
 * count it is worth **against the other filters**, and a box to tick it.
 *
 * The panel is mounted only while its pill is open, and that is what resets the
 * window: `scrollTop` is born with the component, at zero, alongside a scroller
 * that opens at zero too. Kept as state rather than read off the node so the
 * slice is recomputed by the render that follows the scroll, not by a layout
 * read in the middle of one.
 */
export function MultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  labelOf = (value) => value,
}: MultiSelectProps) {
  const { locale, t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(INITIAL_HEIGHT)

  // Measured rather than assumed: the sheet caps the list at seven rows, but a
  // short facet stops earlier. The dependency is whether the list is drawn at
  // all — a facet emptied under an open panel takes it away, and one refilled
  // by a running sweep brings back a node the observer has never seen.
  const listed = options.length > 0
  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height))
    observer.observe(list)
    return () => observer.disconnect()
  }, [listed])

  const onScroll = useCallback(() => setScrollTop(listRef.current?.scrollTop ?? 0), [])

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
    <div className="popover" id={id} role="group" aria-label={label}>
      {/* The facet's size on the left, what is taken of it on the right. The
          count of chosen values and the way back appear together or not at all:
          with nothing ticked there is nothing to count and nothing to undo. */}
      <div className="popover-top">
        <span>{t('filters.facetTotal', { n: options.length })}</span>
        {selected.length > 0 && (
          <>
            <span className="n">{t('filters.chosen', { n: selected.length })}</span>
            <button type="button" className="quiet" onClick={() => onChange([])}>
              {t('filters.uncheckAll')}
            </button>
          </>
        )}
      </div>

      {/* A facet can empty out under an open panel — a fresh sweep recomputes
          the options while its pill is still open — so the empty reading is not
          reserved for a panel that could never have been opened. */}
      {!listed ? (
        <p className="popover-empty">{t('filters.noOptions')}</p>
      ) : (
        /* Windowed, like the results: a sweep over a busy channel yields
           hundreds of creators, and the two panels together would mount as many
           rows again as the table itself. */
        <div className="opts" ref={listRef} onScroll={onScroll}>
          <div style={{ height: options.length * OPTION_HEIGHT, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: firstIndex * OPTION_HEIGHT,
                left: 0,
                right: 0,
              }}
            >
              {options.slice(firstIndex, endIndex).map((option) => {
                const full = labelOf(option.value)
                const { name, id: unresolved } = splitUnresolved(option.value, full)
                const picked = selected.includes(option.value)

                return (
                  <label
                    key={option.value}
                    /* Spent by the other filters: drawn back, never disabled —
                       a checked value can fall to zero, and this panel is the
                       only place it can be unchecked from. */
                    className={option.count === 0 ? 'opt spent' : 'opt'}
                  >
                    {/* A button, not an `input[type=checkbox]`: the state lives
                        on `aria-checked`, which is what the sheet hangs off and
                        what a screen reader announces. Glyph-only, so it keeps
                        the name of the value it stands for. */}
                    <button
                      type="button"
                      className="box"
                      role="checkbox"
                      aria-checked={picked ? 'true' : 'false'}
                      aria-label={full}
                      onClick={() => toggle(option.value)}
                    >
                      <Icon name="check" />
                    </button>
                    {/* The column ellipsises anything past its share — a game's
                        full title, or the id an unresolved category is named
                        by. The attribute is what puts it back within reach. */}
                    <span className="opt-name" title={full}>
                      {name}
                      {unresolved && <span className="id">{unresolved}</span>}
                    </span>
                    <span className="opt-count">{formatCount(option.count, locale)}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
