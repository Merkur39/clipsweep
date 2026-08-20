import { useCallback, useEffect, useRef, useState } from 'react'

import type { ClipSort, SortKey } from '../domain/sort'
import { formatDay, formatDuration } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { CaretIcon, PlayIcon } from './Icon'
import { ResultsEmpty } from './ResultsEmpty'
import { SORT_COLUMNS } from './sortColumns'
import { tileGeometry } from './tileGeometry'
import { gridMetrics, gridRange } from './virtual'

const OVERSCAN = 2
/** Before the first measurement; a plausible stage rather than a blank one. */
const INITIAL_SIZE = { width: 900, height: 560 }

export interface ClipGridProps {
  clips: Clip[]
  /** The tight gallery: more columns, and one readout line more per tile. */
  dense: boolean
  /** Names a game id, for the line only the tight tile carries. */
  gameLabel: (id: string) => string
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  onPlay: (id: string) => void
  sort: ClipSort
  onSortChange: (key: SortKey) => void
}

/**
 * The same clips as the table, given their images. Windowed on the same
 * principle — a sweep surfaces tens of thousands of clips, and that many
 * thumbnails would be as many requests as DOM nodes — except that the window
 * here counts rows of tiles, whose height is measured rather than declared.
 */
export function ClipGrid({
  clips,
  dense,
  gameLabel,
  emptyMessage,
  emptyAction,
  selected,
  onToggle,
  onPlay,
  sort,
  onSortChange,
}: ClipGridProps) {
  const { t } = useTranslation()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [size, setSize] = useState(INITIAL_SIZE)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  // A new order calls for its own beginning, as in the table: the state is
  // adjusted during the render so the window matches the scroll reset of this
  // very render, the DOM being synchronised in the effect below.
  const [renderedSort, setRenderedSort] = useState(sort)
  if (renderedSort !== sort) {
    setRenderedSort(sort)
    setScrollTop(0)
  }

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }, [sort])

  const onScroll = useCallback(() => setScrollTop(scrollerRef.current?.scrollTop ?? 0), [])

  // The gap is applied rather than declared, for the same reason the thumbnail
  // height is: it varies with the density, and two sources for one figure drift.
  const geometry = tileGeometry(dense, size.width)
  const { perRow, thumbHeight, rowHeight } = gridMetrics({ width: size.width, ...geometry })
  const { firstIndex, endIndex, offsetTop, totalHeight } = gridRange({
    scrollTop,
    viewportHeight: size.height,
    rowHeight,
    overscan: OVERSCAN,
    count: clips.length,
    perRow,
  })

  return (
    <div className={dense ? 'grid is-dense' : 'grid'}>
      <div className="grid-head" role="group" aria-label={t('grid.sortBy')}>
        {SORT_COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            className="sort-key"
            aria-pressed={sort.key === column.key}
            onClick={() => onSortChange(column.key)}
          >
            {t(column.label)}
            <span aria-hidden="true" className="sort-key-arrow">
              {sort.key === column.key && <CaretIcon turn={sort.direction === 'asc' ? 0 : 180} />}
            </span>
          </button>
        ))}
      </div>

      <div className="grid-body" ref={scrollerRef} onScroll={onScroll}>
        {clips.length === 0 && <ResultsEmpty message={emptyMessage} action={emptyAction} />}
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            className="grid-rows"
            style={{
              top: offsetTop,
              gap: geometry.gap,
              gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
            }}
          >
            {clips.slice(firstIndex, endIndex).map((clip) => (
              <Tile
                key={clip.id}
                clip={clip}
                dense={dense}
                gameLabel={gameLabel}
                thumbHeight={thumbHeight}
                checked={selected.has(clip.id)}
                onToggle={onToggle}
                onPlay={onPlay}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TileProps {
  clip: Clip
  dense: boolean
  gameLabel: (id: string) => string
  /** Measured, not declared: see `gridMetrics`. */
  thumbHeight: number
  checked: boolean
  onToggle: (id: string) => void
  onPlay: (id: string) => void
}

function Tile({ clip, dense, gameLabel, thumbHeight, checked, onToggle, onPlay }: TileProps) {
  const { locale, t } = useTranslation()
  const title = clip.title || t('table.untitled')
  // A thumbnail can be missing or expired. The broken-image glyph says nothing
  // about the clip behind it, so we draw the hole ourselves.
  const [broken, setBroken] = useState(false)

  return (
    <div className={checked ? 'tile is-picked' : 'tile'}>
      {/*
        Everything but the box opens the player, and it is one single button:
        nesting the checkbox inside it would be invalid markup as much as an
        ambiguous target.
        Its name is stated rather than left to its content, which would run the
        title, the length, the counts and the date together into one breath —
        and would say all that without ever saying what a click does. The
        content stays readable in browse mode, where nothing is lost.
      */}
      <button
        type="button"
        className="tile-open"
        aria-label={t('table.play', { title: clip.title || t('table.untitledClip') })}
        onClick={() => onPlay(clip.id)}
      >
        <span className="tile-frame" style={{ height: thumbHeight }}>
          {clip.thumbnail_url && !broken ? (
            <img
              className="tile-thumb"
              src={clip.thumbnail_url}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="tile-thumb tile-thumb-missing" aria-hidden="true">
              <PlayIcon />
            </span>
          )}
          <span className="tile-duration">{formatDuration(clip.duration)}</span>
        </span>
        <span className="tile-title">{title}</span>
        {/* The tight tile splits the readout in two rather than saying more in
            one breath: the counts and who clipped it on the first line, when
            and from what on the second — which is the room its `metaHeight`
            buys. The large tile keeps the date on its single line, since it
            has no second one to move it to. */}
        <span className="tile-meta">
          {/* Zero views: the case the sweep exists to unearth, painted here as
              it is in the table. */}
          <span className={clip.view_count === 0 ? 'tile-views zero' : 'tile-views'}>
            {t('results.views', { n: clip.view_count })}
          </span>
          {dense
            ? ` · ${clip.creator_name || '—'}`
            : ` · ${formatDay(clip.created_at, locale)} · ${clip.creator_name || '—'}`}
        </span>
        {dense && (
          <span className="tile-meta tile-meta-under">
            {formatDay(clip.created_at, locale)}
            {/* An id with no row at Helix is named a category rather than shown
                bare; a clip filed under nothing at all gets no mention. */}
            {clip.game_id ? ` · ${gameLabel(clip.game_id)}` : ''}
          </span>
        )}
      </button>

      <label className="tile-pick">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(clip.id)}
          aria-label={clip.title || t('table.untitledClip')}
        />
      </label>
    </div>
  )
}
