import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import { selectionState } from '../domain/selection'
import type { ClipSort, SortKey } from '../domain/sort'
import { formatCount, formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { MessageKey } from '../i18n/messages.fr'
import type { Clip } from '../twitch/types'
import { CaretIcon } from './Icon'
import { visibleRange } from './virtual'

const ROW_HEIGHT = 34
const OVERSCAN = 8

const COLUMNS: { key: SortKey; label: MessageKey; className: string }[] = [
  { key: 'views', label: 'table.views', className: 'col-views' },
  { key: 'date', label: 'table.date', className: 'col-date' },
  { key: 'title', label: 'table.title', className: 'col-title' },
  { key: 'creator', label: 'table.creator', className: 'col-author' },
]

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
  deselected: ReadonlySet<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  sort: ClipSort
  onSortChange: (key: SortKey) => void
}

export function ClipTable({
  clips,
  emptyMessage,
  emptyAction,
  deselected,
  onToggle,
  onToggleAll,
  sort,
  onSortChange,
}: ClipTableProps) {
  const { locale, t } = useTranslation()
  const state = selectionState(clips, deselected)
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

  // Un nouvel ordre appelle son début : rester au même pixel laisserait
  // l'utilisateur devant des clips entièrement différents, sans repère.
  //
  // L'état est ajusté pendant le rendu, pas dans l'effet : la fenêtre visible
  // doit correspondre au défilement remis à zéro dès ce rendu, sinon on
  // calculerait les lignes autour de l'ancienne position et l'écran serait vide.
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
   * Toute la ligne coche, sauf sur ses deux cibles propres : le titre est un
   * lien vers le clip, et la case déclenche déjà son `onChange` — la laisser
   * remonter jusqu'ici annulerait aussitôt le basculement.
   *
   * Pas de `tabIndex` ni de `role="button"` : la case porte déjà l'accès
   * clavier, en dupliquer un par ligne mettrait des milliers d'arrêts de
   * tabulation dans la table.
   */
  const rowClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, id: string) => {
      if ((event.target as HTMLElement).closest('a, input')) return
      // Une sélection de texte se termine par un clic : elle ne coche rien.
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
            aria-label={state === 'all' ? t('table.uncheckAll') : t('table.checkAll')}
          />
        </span>
        {COLUMNS.map((column) => (
          <span
            key={column.key}
            className={column.className}
            aria-sort={
              sort.key !== column.key
                ? 'none'
                : sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
            }
          >
            <button type="button" className="col-sort" onClick={() => onSortChange(column.key)}>
              {t(column.label)}
              <span aria-hidden="true" className="col-sort-arrow">
                {sort.key === column.key && <CaretIcon turn={sort.direction === 'asc' ? 0 : 180} />}
              </span>
            </button>
          </span>
        ))}
      </div>

      <div className="table-body" ref={scrollerRef} onScroll={onScroll} role="rowgroup">
        {clips.length === 0 && (
          <p className="table-empty">
            {emptyMessage}
            {emptyAction && (
              <>
                {' '}
                <button type="button" className="link" onClick={emptyAction.onClick}>
                  {emptyAction.label}
                </button>
              </>
            )}
          </p>
        )}
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
                    checked={!deselected.has(clip.id)}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
