import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'

import { selectionState } from '../domain/selection'
import type { ClipSort, SortKey } from '../domain/sort'
import { formatCount, formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { Icon } from './Icon'
import { ResultsEmpty } from './ResultsEmpty'
import { SORT_COLUMNS } from './sortColumns'
import { visibleRange } from './virtual'

/**
 * The drawn height of a row, restated from `--row` in base.css: the virtualiser
 * places rows at absolute offsets, so the number it multiplies by and the number
 * the sheet draws must be the same one. Change one, change the other.
 */
const ROW_HEIGHT = 52
const OVERSCAN = 8

/**
 * The view bar's two bounds, in pixels, inside the 108px views track.
 *
 * The ceiling leaves room for the figure beside it; the floor is what keeps a
 * clip with a handful of views from drawing nothing at all — a bar of zero
 * length reads as a missing value rather than as a small one, and the column
 * would lose its left edge halfway down the list.
 */
const BAR_MAX = 44
const BAR_MIN = 6

/**
 * What each sortable column's head cell carries besides its sort key.
 *
 * `.num` files a figure column's label against its values rather than against
 * the track's left edge. `.creator-head` is the handle the 768–1079 tier hides
 * the creator by: the cell alone would leave every following head one track out
 * of step with the values under it.
 */
const HEAD_CLASS: Record<SortKey, string | undefined> = {
  views: 'num',
  date: 'num',
  title: undefined,
  creator: 'creator-head',
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
  /** A sweep is under way and has yet to deliver: the empty state waits rather
   *  than reporting nothing. */
  busy?: boolean
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
  busy,
  selected,
  onToggle,
  onToggleAll,
  onPlay,
  sort,
  onSortChange,
}: ClipTableProps) {
  const { locale, t } = useTranslation()
  const state = selectionState(clips, selected)
  const nothingToPick = clips.length === 0
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

  /**
   * The busiest clip of the list is what the bars are drawn against — a share
   * of the visible maximum, not of some absolute Twitch scale that would leave
   * every bar of a modest channel at one pixel.
   *
   * Memoised on `clips`, which is a fresh array on every sort and every change
   * of filter and identical otherwise: the sweep is the one thing that must not
   * pay a full pass over tens of thousands of rows on each scroll tick.
   */
  const peakViews = useMemo(
    () => clips.reduce((peak, clip) => (clip.view_count > peak ? clip.view_count : peak), 0),
    [clips],
  )

  /**
   * A count turned into a length. The guard is not decorative: a list filtered
   * down to clips with no views at all has a maximum of zero, and the ratio
   * would be `NaN` — a width React would then drop, leaving the column ragged.
   */
  const barWidth = (views: number) => {
    if (peakViews <= 0) return BAR_MIN
    return Math.min(BAR_MAX, Math.max(BAR_MIN, Math.round((views / peakViews) * BAR_MAX)))
  }

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

  // The DOM, for its part, does synchronise properly in an effect.
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }, [sort])

  const onScroll = useCallback(() => setScrollTop(scrollerRef.current?.scrollTop ?? 0), [])

  /**
   * The whole row ticks the box, save on its own three targets: the title is a
   * link to the clip, the play button opens the player — watching a clip is not
   * choosing it — and the checkbox already fires its own handler, which bubbling
   * up here would immediately undo.
   *
   * Two selectors for three exemptions now that the checkbox is a real button
   * rather than an `<input>`: `button` covers both of the row's controls.
   *
   * No `tabIndex` and no `role="button"`: the two controls of the row already
   * carry keyboard access, and duplicating one on the row itself would add a
   * third stop per row for an action already reachable.
   */
  const rowClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, id: string) => {
      if ((event.target as HTMLElement).closest('a, button')) return
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
    <div className="tbl">
      <div className="thead" role="row">
        {/* The check column is headed by no label — there is nothing to sort a
            selection by — but it does hold the select-all, whose third state is
            the only place `aria-checked="mixed"` is used in the whole product. */}
        <span>
          <button
            type="button"
            className="box"
            role="checkbox"
            aria-checked={state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'}
            // Not `disabled`: the sheet hangs the unavailable state off the ARIA
            // attribute, and a control that stays focusable is a control the
            // keyboard can still read the name of.
            aria-disabled={nothingToPick ? 'true' : undefined}
            aria-label={state === 'all' ? t('results.deselectAll') : t('results.selectAll')}
            onClick={nothingToPick ? undefined : onToggleAll}
          >
            <Icon name="check" size={11} />
          </button>
        </span>
        {SORT_COLUMNS.map((column) => {
          const sorted = sort.key === column.key

          return (
            <span
              key={column.key}
              className={HEAD_CLASS[column.key]}
              aria-sort={!sorted ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending'}
            >
              <button
                type="button"
                className="sort-key"
                aria-pressed={sorted ? 'true' : 'false'}
                onClick={() => onSortChange(column.key)}
              >
                {t(column.label)}
                {/* The slot is drawn whether or not this column is the sorted
                    one, so turning the sort on does not shift the label under
                    the pointer that just clicked it. The direction is a rotated
                    chevron — `.asc` turns it, `.desc` is where it already
                    points — never a Unicode arrow in the string. */}
                <span
                  aria-hidden="true"
                  className={
                    sorted
                      ? `sort-key-arrow ${sort.direction === 'asc' ? 'asc' : 'desc'}`
                      : 'sort-key-arrow'
                  }
                >
                  {sorted && <Icon name="chevron" size={12} />}
                </span>
              </button>
            </span>
          )
        })}
        {/* The play column has no label to give, but it has a track to hold:
            head and rows share one template. */}
        <span />
      </div>

      <div className="tbody" ref={scrollerRef} onScroll={onScroll} role="rowgroup">
        {nothingToPick && <ResultsEmpty message={emptyMessage} action={emptyAction} busy={busy} />}
        <div style={{ height: clips.length * ROW_HEIGHT, position: 'relative' }}>
          <div style={{ position: 'absolute', top: firstIndex * ROW_HEIGHT, left: 0, right: 0 }}>
            {slice.map((clip) => {
              const picked = selected.has(clip.id)
              const name = clip.title || t('table.untitledClip')

              return (
                <div
                  className={picked ? 'trow picked' : 'trow'}
                  role="row"
                  key={clip.id}
                  // Restated from the sheet on purpose: the height the row is
                  // drawn at and the height it is placed at come from the same
                  // constant, so the two can never drift apart.
                  style={{ height: ROW_HEIGHT }}
                  onClick={(event) => rowClick(event, clip.id)}
                >
                  <button
                    type="button"
                    className="box"
                    role="checkbox"
                    aria-checked={picked ? 'true' : 'false'}
                    aria-label={name}
                    onClick={() => onToggle(clip.id)}
                  >
                    <Icon name="check" size={11} />
                  </button>
                  <span className={clip.view_count === 0 ? 'views zero' : 'views'}>
                    <u style={{ width: barWidth(clip.view_count) }} />
                    <b>{formatCount(clip.view_count, locale)}</b>
                  </span>
                  <span className="date-cell">{formatDay(clip.created_at, locale)}</span>
                  <span className="title-cell">
                    <a href={clip.url} target="_blank" rel="noreferrer" title={clip.title}>
                      {clip.title || t('table.untitled')}
                    </a>
                  </span>
                  <span className="creator-cell">{clip.creator_name || '—'}</span>
                  <button
                    type="button"
                    className="playbtn"
                    aria-label={t('table.play', { title: name })}
                    onClick={() => onPlay(clip.id)}
                  >
                    <Icon name="play" size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
