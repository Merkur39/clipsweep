import { useEffect, useRef, useState } from 'react'

import type { TileView } from '../domain/view'
import { useWindowRows } from '../hooks/useWindowRows'
import { formatDay, formatDuration } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { PlayIcon } from './Icon'
import { ResultsEmpty } from './ResultsEmpty'
import { TILE_GEOMETRY } from './tileGeometry'
import { gridMetrics, gridRange, keepFirstVisible } from './virtual'

const OVERSCAN = 2

export interface ClipGridProps {
  clips: Clip[]
  /** Which of the two tile densities is on screen; see `tileGeometry.ts`. */
  view: TileView
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  onPlay: (id: string) => void
  /**
   * Which clip the pointer is over, or null on the way out. It drives no
   * rendering — the sheet already draws the hovered tile — so the caller is
   * free to hold it in a ref and spend nothing on it.
   */
  onHover: (id: string | null) => void
  /* No `sort` here, unlike the table: a board of images has no column head to
     click, so the order is only ever asked for from the toolbar — which is
     above the board, hence on screen only when its beginning already is. There
     is no place to bring the reader back to. */
}

/**
 * The same clips as the table, given their images, at either of two densities.
 * Windowed on the same principle — a search surfaces tens of thousands of clips,
 * and that many thumbnails would be as many requests as DOM nodes — except that
 * the window here counts rows of tiles, whose height is measured rather than
 * declared.
 *
 * The board flows in the page and the page is what scrolls: there is no box
 * around it and no scrollbar of its own, so the window is read off the screen —
 * see `useWindowRows`. What that costs is the one gesture below; what it buys is
 * the design's own shape, a readout that is the page rather than a pane in it.
 */
export function ClipGrid({
  clips,
  view,
  emptyMessage,
  emptyAction,
  selected,
  onToggle,
  onPlay,
  onHover,
}: ClipGridProps) {
  const rowsRef = useRef<HTMLDivElement>(null)
  const { scrollTop, viewportHeight, width } = useWindowRows(rowsRef)

  const geometry = TILE_GEOMETRY[view]
  const { perRow, thumbHeight, rowHeight } = gridMetrics({ width, ...geometry })

  /**
   * A new density does not call for a new beginning, unlike a new order: the
   * clips are in the same places, drawn at another size. What it calls for is
   * the reader's own place back — the same offset names another clip once the
   * rows change height, and 1 · 2 · 3 switch density from anywhere in the list.
   *
   * `drawn` follows every change of geometry, resize included, and not only the
   * changes of density: read back through metrics several widths old, the
   * offset would name the wrong clip just as surely. Only a change of density
   * carries an offset to restore, though — a resize has already moved the page
   * under the reader, and moving it again would be a second surprise.
   *
   * And only when the board has actually run off the top of the screen. With
   * its beginning in view there is no place to bring anyone back to, and
   * scrolling to the top of the board would push the ticket off the top of the
   * page — the reader pressed 2, not "hide the search".
   */
  const [drawn, setDrawn] = useState({ view, perRow, rowHeight, keep: null as number | null })
  if (drawn.view !== view || drawn.perRow !== perRow || drawn.rowHeight !== rowHeight) {
    setDrawn({
      view,
      perRow,
      rowHeight,
      keep:
        drawn.view === view || scrollTop === 0
          ? null
          : keepFirstVisible(scrollTop, drawn, { perRow, rowHeight }),
    })
  }

  useEffect(() => {
    const node = rowsRef.current
    if (drawn.keep === null || !node) return

    // The offset is counted from the top of the rows, and the page is scrolled
    // in the document's own terms: the rect gives the distance between the two,
    // measured after the new density has been drawn.
    window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY + drawn.keep)
  }, [drawn])

  const { firstIndex, endIndex, offsetTop, totalHeight } = gridRange({
    scrollTop,
    viewportHeight,
    rowHeight,
    overscan: OVERSCAN,
    count: clips.length,
    perRow,
  })

  return (
    <div className="grid" data-density={view}>
      {clips.length === 0 && <ResultsEmpty message={emptyMessage} action={emptyAction} />}
      {/* The node the window is measured against, and the one that reserves the
          height of every row. On the way out, once: leaving one tile for the
          next is an enter, and only leaving the whole board clears what the
          keyboard acts on. */}
      <div
        ref={rowsRef}
        style={{ height: totalHeight, position: 'relative' }}
        onMouseLeave={() => onHover(null)}
      >
        <div
          className="grid-rows"
          style={{
            top: offsetTop,
            gap: `${geometry.rowGap}px ${geometry.gap}px`,
            gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
          }}
        >
          {clips.slice(firstIndex, endIndex).map((clip) => (
            <Tile
              key={clip.id}
              clip={clip}
              thumbHeight={thumbHeight}
              checked={selected.has(clip.id)}
              onToggle={onToggle}
              onPlay={onPlay}
              onHover={onHover}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface TileProps {
  onHover: (id: string | null) => void
  clip: Clip
  /** Measured, not declared: see `gridMetrics`. */
  thumbHeight: number
  checked: boolean
  onToggle: (id: string) => void
  onPlay: (id: string) => void
}

function Tile({ clip, thumbHeight, checked, onToggle, onPlay, onHover }: TileProps) {
  const { locale, t } = useTranslation()
  const title = clip.title || t('table.untitled')
  // A thumbnail can be missing or expired. The broken-image glyph says nothing
  // about the clip behind it, so we draw the hole ourselves.
  const [broken, setBroken] = useState(false)

  return (
    /* No mark on the tile itself, which has no frame left to carry one: the box
       at the foot of the image is what says a clip is kept, and it is drawn
       whether it is or not. */
    <div className="tile" onMouseEnter={() => onHover(clip.id)}>
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
        title={t('table.playHint')}
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
        <span className="tile-meta">
          {/* Zero views: the case the search exists to unearth, painted here as
              it is in the table. */}
          <span className={clip.view_count === 0 ? 'tile-views zero' : 'tile-views'}>
            {t('results.views', { n: clip.view_count })}
          </span>
          {` · ${formatDay(clip.created_at, locale)} · ${clip.creator_name || '—'}`}
        </span>
      </button>

      {/* At the foot of the image, and the image's height is the only thing
          that says where that is — the same figure the frame was drawn with,
          never a second copy of it. */}
      <label className="tile-pick" style={{ top: thumbHeight }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(clip.id)}
          aria-label={clip.title || t('table.untitledClip')}
          title={t('table.pickHint')}
        />
      </label>
    </div>
  )
}
