import { useEffect, useRef, type MouseEvent } from 'react'

import { useWindowRows } from '../hooks/useWindowRows'
import { selectionState } from '../domain/selection'
import type { ClipSort, SortKey } from '../domain/sort'
import { formatCount, formatDay, formatDuration } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { CaretIcon, PlayIcon } from './Icon'
import { ResultsEmpty } from './ResultsEmpty'
import { COLUMNS } from './sortColumns'
import { visibleRange } from './virtual'

/**
 * The row's height, applied inline rather than drawn: the virtualiser
 * multiplies it to place rows, so there is nothing here for a sheet to
 * contradict. 44 for a line of type at the body size, its own hairline
 * included.
 */
const ROW_HEIGHT = 44
const OVERSCAN = 8

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
  /**
   * Which clip the pointer is over, or null on the way out. It drives no
   * rendering — the sheet already draws the hovered row — so the caller is free
   * to hold it in a ref and spend nothing on it.
   */
  onHover: (id: string | null) => void
  sort: ClipSort
  onSortChange: (key: SortKey) => void
  /** Maps a game id to what the reader sees — the filter chip's own resolver. */
  gameLabel: (id: string) => string
}

export function ClipTable({
  clips,
  emptyMessage,
  emptyAction,
  selected,
  onToggle,
  onToggleAll,
  onPlay,
  onHover,
  sort,
  onSortChange,
  gameLabel,
}: ClipTableProps) {
  const { locale, t } = useTranslation()
  const state = selectionState(clips, selected)
  const tableRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const { scrollTop, viewportHeight } = useWindowRows(rowsRef)

  /**
   * A new order calls for its own beginning: staying at the same pixel would
   * leave the reader in front of entirely different clips, with no landmark.
   * The head is sticky, so an order can be asked for a thousand rows down —
   * this is not a case the toolbar's chip could produce on its own.
   *
   * Guarded on the list having already run off the top of the screen: asked for
   * with its beginning in view, a scroll would push the ticket off the top
   * instead, which is an answer to a question nobody asked.
   */
  useEffect(() => {
    const node = tableRef.current
    if (!node) return

    const top = node.getBoundingClientRect().top
    if (top < 0) window.scrollTo(0, top + window.scrollY)
    // The two values, never the object: a caller rebuilding an equal `sort`
    // literal on every render would scroll the page on every render.
  }, [sort.key, sort.direction])

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
  const rowClick = (event: MouseEvent<HTMLDivElement>, id: string) => {
    if ((event.target as HTMLElement).closest('a, input, button')) return
    // A text selection ends with a click: it must check nothing.
    if (!window.getSelection()?.isCollapsed) return
    onToggle(id)
  }

  const { firstIndex, endIndex } = visibleRange({
    scrollTop,
    viewportHeight,
    rowHeight: ROW_HEIGHT,
    overscan: OVERSCAN,
    count: clips.length,
  })
  const slice = clips.slice(firstIndex, endIndex)

  return (
    <div className="table" ref={tableRef}>
      <div className="table-body" role="rowgroup">
        {/* Stuck to the top of the screen rather than of a box: the list flows
            in the page now, so what it scrolls under is the window. It is what
            lets an order be asked for from anywhere in nine hundred rows —
            hence the return to the beginning above. */}
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
          {COLUMNS.map(({ className, label, key: sortKey }) => {
            /* Pulled out of the column before the branch: read back off the object
             inside the click handler, the narrowing this branch performs does
             not survive into the closure. */
            if (sortKey === undefined) {
              /* A head that only names its column. Drawn as a label rather than
               as a dead button: a control that looks like its five neighbours
               and answers to nothing is worse than no control at all. */
              return (
                <span key={className} className={className}>
                  {t(label)}
                </span>
              )
            }

            return (
              <span
                key={className}
                className={className}
                aria-sort={
                  sort.key !== sortKey
                    ? 'none'
                    : sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                }
              >
                <button type="button" className="sort-key" onClick={() => onSortChange(sortKey)}>
                  {t(label)}
                  <span aria-hidden="true" className="sort-key-arrow">
                    {sort.key === sortKey && (
                      <CaretIcon turn={sort.direction === 'asc' ? 0 : 180} />
                    )}
                  </span>
                </button>
              </span>
            )
          })}
          {/* The actions column has no label to give, but it has a track to
              hold: head and rows share one template. */}
          <span className="col-play" />
        </div>

        {clips.length === 0 && <ResultsEmpty message={emptyMessage} action={emptyAction} />}
        {/* The node the window is measured against, and the one that reserves
            the height of every row. On the way out, once: leaving one row for
            the next is an enter, and only leaving the whole list clears what
            the keyboard acts on. */}
        <div
          ref={rowsRef}
          style={{ height: clips.length * ROW_HEIGHT, position: 'relative' }}
          onMouseLeave={() => onHover(null)}
        >
          <div style={{ position: 'absolute', top: firstIndex * ROW_HEIGHT, left: 0, right: 0 }}>
            {slice.map((clip, offset) => (
              <div
                /* The stripe follows the row's rank in the list, never its rank
                   in the slice: the slice starts one row further on every
                   scroll step, and a `:nth-child` would repaint every stripe in
                   the readout each time the window moved. */
                className={(firstIndex + offset) % 2 === 0 ? 'table-row is-banded' : 'table-row'}
                role="row"
                key={clip.id}
                style={{ height: ROW_HEIGHT }}
                onClick={(event) => rowClick(event, clip.id)}
                onMouseEnter={() => onHover(clip.id)}
              >
                <span className="col-pick">
                  <input
                    type="checkbox"
                    checked={selected.has(clip.id)}
                    onChange={() => onToggle(clip.id)}
                    aria-label={clip.title || t('table.untitledClip')}
                    title={t('table.pickHint')}
                  />
                </span>
                <span className="col-title">
                  <a href={clip.url} target="_blank" rel="noreferrer" title={clip.title}>
                    {clip.title || t('table.untitled')}
                  </a>
                </span>
                <span className={clip.view_count === 0 ? 'col-views zero' : 'col-views'}>
                  {formatCount(clip.view_count, locale)}
                </span>
                <span className="col-author">{clip.creator_name || '—'}</span>
                {/* Helix leaves the category empty on a clip taken off-stream:
                    the resolver would name that nothing "Sans nom ()". */}
                <span className="col-game">{clip.game_id ? gameLabel(clip.game_id) : '—'}</span>
                <span className="col-date">{formatDay(clip.created_at, locale)}</span>
                <span className="col-length">{formatDuration(clip.duration)}</span>
                <span className="col-play">
                  <button
                    type="button"
                    className="row-play"
                    aria-label={t('table.play', {
                      title: clip.title || t('table.untitledClip'),
                    })}
                    title={t('table.playHint')}
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
