import { useCallback, useEffect, useRef, useState } from 'react'

import type { ClipSort, SortKey } from '../domain/sort'
import { formatDay, formatDuration } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { Icon } from './Icon'
import { ResultsEmpty } from './ResultsEmpty'
import { SORT_COLUMNS } from './sortColumns'
import { gridMetrics, gridRange } from './virtual'

/**
 * The half of a tile's geometry that TypeScript owns, and that `clip-grid.css`
 * draws. Change one without the other and the placed rows land beside the
 * drawn ones.
 *
 * `META_HEIGHT` is the block under the thumbnail: 8 + 34 + 2 + 16 + 8. The
 * title box is two lines of 17px written in pixels on purpose — a relative
 * leading is a ratio of a font size, and a ratio cannot promise the 34px this
 * figure counts on. The tile's two hairlines are *not* in it: they come off the
 * column as well as adding to the row, so `gridMetrics` takes them as their own
 * input.
 *
 * `GAP` is `--sp-6`, and it is the same figure at every tier. The design files
 * tighten the gutter on a phone; here it stays put, because this number is
 * written twice — once here, once in the sheet — and a value that moved at a
 * breakpoint could only stay honest by being read back out of the DOM. The
 * tiers move the padding instead, and the column count follows on its own.
 */
const META_HEIGHT = 68
const GAP = 16
const TILE_BORDER = 1
const OVERSCAN = 2

/** The width the design draws a tile at, and the floor on a board with room. */
const TILE_WIDTH = 190

/** Before the first measurement; a plausible stage rather than a blank one. */
const INITIAL_SIZE = { width: 900, height: 560 }

/**
 * Three keys, not the table's four. The creator is written on every tile but
 * heads none of them: the strip is a plate of silkscreen keys, not a set of
 * column headers, and the fourth would push it past what a phone has to spare.
 */
const GRID_SORT_KEYS = SORT_COLUMNS.filter((column) => column.key !== 'creator')

/**
 * The narrowest a tile may be drawn on a board this wide.
 *
 * On a board with room the floor is the width the design draws a tile at, and
 * the columns divide what is left without ever going under it. A phone has no
 * such room — 360px of viewport leaves about 300px of board — and the design
 * asks for two tiles up there all the same, so below twice the design width the
 * floor is simply half the board.
 *
 * The tiers then fall out of the measurement rather than out of a breakpoint:
 * two up on every phone and up to a 600px window, three from 768, five at
 * 1440. One rule, and no figure in this file has to know what a viewport is.
 */
function tileMin(width: number): number {
  return Math.min(TILE_WIDTH, Math.max(0, (width - GAP) / 2))
}

export interface ClipGridProps {
  clips: Clip[]
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  /** A sweep is under way and has yet to deliver: the empty state waits rather
   *  than reporting nothing. */
  busy?: boolean
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
  emptyMessage,
  emptyAction,
  busy,
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

  const { perRow, thumbHeight, rowHeight } = gridMetrics({
    width: size.width,
    tileMin: tileMin(size.width),
    gap: GAP,
    metaHeight: META_HEIGHT,
    border: TILE_BORDER,
  })
  const { firstIndex, endIndex, offsetTop, totalHeight } = gridRange({
    scrollTop,
    viewportHeight: size.height,
    rowHeight,
    overscan: OVERSCAN,
    count: clips.length,
    perRow,
  })

  return (
    <>
      {/* No visible "Sort" label: three silkscreen keys with one of them
          pressed say what they are by being the only thing on the strip. The
          group carries the name for whoever cannot see that. */}
      <div className="sort-row" role="group" aria-label={t('grid.sortBy')}>
        {GRID_SORT_KEYS.map((column) => {
          const active = sort.key === column.key

          return (
            <button
              key={column.key}
              type="button"
              className="sort-key"
              aria-pressed={active}
              onClick={() => onSortChange(column.key)}
            >
              {t(column.label)}
              {/* The slot is drawn whether it holds a chevron or not, so turning
                  a key on shifts no label. The direction is a class on the slot
                  and never a character in a string: `.asc` turns the glyph over,
                  `.desc` is where it already points. */}
              <span
                aria-hidden="true"
                className={active ? `sort-key-arrow ${sort.direction}` : 'sort-key-arrow'}
              >
                {active && <Icon name="chevron" size={12} />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="tiles-scroll" ref={scrollerRef} onScroll={onScroll}>
        {clips.length === 0 && (
          <ResultsEmpty message={emptyMessage} action={emptyAction} busy={busy} />
        )}
        {/* The spacer holds the whole board's height so the scrollbar tells the
            truth about a list only a slice of which exists. */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            className="tiles"
            style={{
              top: offsetTop,
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
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

interface TileProps {
  clip: Clip
  /** Computed, not declared: see `gridMetrics`. */
  thumbHeight: number
  checked: boolean
  onToggle: (id: string) => void
  onPlay: (id: string) => void
}

function Tile({ clip, thumbHeight, checked, onToggle, onPlay }: TileProps) {
  const { locale, t } = useTranslation()
  const title = clip.title || t('table.untitled')
  // A thumbnail can be missing or expired. The broken-image glyph says nothing
  // about the clip behind it, so we draw the hole ourselves.
  const [broken, setBroken] = useState(false)

  return (
    <div className={checked ? 'tile picked' : 'tile'}>
      {/*
        Everything but the box opens the player, and it is one single button:
        nesting the checkbox inside it would be invalid markup as much as an
        ambiguous target.
        Its name is stated rather than left to its content, which would run the
        title, the length, the counts and the date together into one breath —
        and would say all that without ever saying what a click does. The
        content stays readable in browse mode, where nothing is lost.
        Its children are spans and not paragraphs for the same reason the box
        sits outside: a button takes phrasing content, and the sheet gives the
        two lines the `display` their heights need anyway.
      */}
      <button
        type="button"
        className="tile-open"
        aria-label={t('table.play', { title: clip.title || t('table.untitledClip') })}
        onClick={() => onPlay(clip.id)}
      >
        {/* The ratio is in the sheet, the pixel height is set here: both say
            16:9, but only the one the virtualiser rounded can be the one the
            row was placed for. */}
        <span className="thumb" style={{ height: thumbHeight }}>
          {clip.thumbnail_url && !broken ? (
            <img
              src={clip.thumbnail_url}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="thumb-missing" />
          )}
          <span className="dur">{formatDuration(clip.duration)}</span>
        </span>
        <span className="tt">{title}</span>
        <span className="tm">
          {/* Zero views: the case the sweep exists to unearth, painted here as
              it is in the table. */}
          <span className={clip.view_count === 0 ? 'z' : undefined}>
            {t('results.views', { n: clip.view_count })}
          </span>
          {` · ${formatDay(clip.created_at, locale)} · ${clip.creator_name || '—'}`}
        </span>
      </button>

      {/* A button with the checkbox role, not an `<input>`: the state lives in
          `aria-checked`, which is what the sheet hangs off. `.on-image` is the
          halo it needs to hold against a thumbnail of any colour. */}
      <button
        type="button"
        className="box on-image"
        role="checkbox"
        aria-checked={checked ? 'true' : 'false'}
        aria-label={clip.title || t('table.untitledClip')}
        onClick={() => onToggle(clip.id)}
      >
        <Icon name="check" />
      </button>
    </div>
  )
}
