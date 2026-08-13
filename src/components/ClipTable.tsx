import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import { selectionState } from '../domain/selection'
import type { ClipSort, SortKey } from '../domain/sort'
import { formatCount, formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { CaretIcon, PlayIcon } from './Icon'
import { ResultsEmpty } from './ResultsEmpty'
import { SORT_COLUMNS } from './sortColumns'
import { visibleRange } from './virtual'

const ROW_HEIGHT = 34
const OVERSCAN = 8

/** Which column each sortable key heads, the offer itself being shared. */
const COLUMN_CLASS: Record<SortKey, string> = {
  views: 'col-views',
  date: 'col-date',
  title: 'col-title',
  creator: 'col-author',
}

/**
 * Windowed rendering: the whole point of the tool is to surface tens of
 * thousands of clips, which no browser will lay out as real DOM rows.
 *
 * Sorting composes with it for free: the window slices an already ordered
 * array, so ordering happens upstream and this component never knows.
 */
export interface ClipTableProps {
  clips: Clip[]
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onPlay: (id: string) => void
  sort: ClipSort
  onSortChange: (key: SortKey) => void
}

export function ClipTable({
  clips,
  emptyMessage,
  emptyAction,
  selected,
  onToggle,
  onToggleAll,
  onPlay,
  sort,
  onSortChange,
}: ClipTableProps) {
  const { locale, t } = useTranslation()
  const state = selectionState(clips, selected)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(560)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height))
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  // A new order calls for its own beginning: staying at the same pixel would
  // leave the user in front of entirely different clips, with no landmark.
  //
  // The state is adjusted during the render, not in the effect: the visible
  // window must match the scroll reset from this very render, otherwise we would
  // compute the rows around the old position and the screen would be blank.
  const [renderedSort, setRenderedSort] = useState(sort)
  if (renderedSort !== sort) {
    setRenderedSort(sort)
    setScrollTop(0)
  }

  // Le DOM, lui, se synchronise bien dans un effet.
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }, [sort])

  const onScroll = useCallback(() => setScrollTop(scrollerRef.current?.scrollTop ?? 0), [])

  /**
   * The whole row ticks the box, save on its own three targets: the title is a
   * link to the clip, the play button opens the player — watching a clip is not
   * choosing it — and the checkbox already fires its own `onChange`, which
   * bubbling up here would immediately undo.
   *
   * No `tabIndex` and no `role="button"`: the two controls of the row already
   * carry keyboard access, and duplicating one on the row itself would add a
   * third stop per row for an action already reachable.
   */
  const rowClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, id: string) => {
      if ((event.target as HTMLElement).closest('a, input, button')) return
      // A text selection ends with a click: it must check nothing.
      if (!window.getSelection()?.isCollapsed) return
      onToggle(id)
    },
    [onToggle],
  )

  const { firstIndex, endIndex } = visibleRange({
    scrollTop,
    viewportHeight,
    rowHeight: ROW_HEIGHT,
    overscan: OVERSCAN,
    count: clips.length,
  })
  const slice = clips.slice(firstIndex, endIndex)

  return (
    <div className="table">
      <div className="table-head" role="row">
        <span className="col-pick">
          <input
            type="checkbox"
            checked={state === 'all'}
            // `indeterminate` is a DOM property, not an attribute React can set.
            ref={(node) => {
              if (node) node.indeterminate = state === 'some'
            }}
            disabled={clips.length === 0}
            onChange={onToggleAll}
            aria-label={state === 'all' ? t('results.deselectAll') : t('results.selectAll')}
          />
        </span>
        {SORT_COLUMNS.map((column) => (
          <span
            key={column.key}
            className={COLUMN_CLASS[column.key]}
            aria-sort={
              sort.key !== column.key
                ? 'none'
                : sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
            }
          >
            <button type="button" className="sort-key" onClick={() => onSortChange(column.key)}>
              {t(column.label)}
              <span aria-hidden="true" className="sort-key-arrow">
                {sort.key === column.key && <CaretIcon turn={sort.direction === 'asc' ? 0 : 180} />}
              </span>
            </button>
          </span>
        ))}
        {/* The actions column has no label to give, but it has a track to hold:
            head and rows share one template. */}
        <span className="col-play" />
      </div>

      <div className="table-body" ref={scrollerRef} onScroll={onScroll} role="rowgroup">
        {clips.length === 0 && <ResultsEmpty message={emptyMessage} action={emptyAction} />}
        <div style={{ height: clips.length * ROW_HEIGHT, position: 'relative' }}>
          <div style={{ position: 'absolute', top: firstIndex * ROW_HEIGHT, left: 0, right: 0 }}>
            {slice.map((clip) => (
              <div
                className="table-row"
                role="row"
                key={clip.id}
                style={{ height: ROW_HEIGHT }}
                onClick={(event) => rowClick(event, clip.id)}
              >
                <span className="col-pick">
                  <input
                    type="checkbox"
                    checked={selected.has(clip.id)}
                    onChange={() => onToggle(clip.id)}
                    aria-label={clip.title || t('table.untitledClip')}
                  />
                </span>
                <span className={clip.view_count === 0 ? 'col-views zero' : 'col-views'}>
                  {formatCount(clip.view_count, locale)}
                </span>
                <span className="col-date">{formatDay(clip.created_at, locale)}</span>
                <span className="col-title">
                  <a href={clip.url} target="_blank" rel="noreferrer" title={clip.title}>
                    {clip.title || t('table.untitled')}
                  </a>
                </span>
                <span className="col-author">{clip.creator_name || '—'}</span>
                <span className="col-play">
                  <button
                    type="button"
                    className="row-play"
                    aria-label={t('table.play', {
                      title: clip.title || t('table.untitledClip'),
                    })}
                    onClick={() => onPlay(clip.id)}
                  >
                    <PlayIcon />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
