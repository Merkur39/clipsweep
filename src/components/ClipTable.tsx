import { useCallback, useEffect, useRef, useState } from 'react'

import { selectionState } from '../domain/selection'
import type { Clip } from '../twitch/types'
import { visibleRange } from './virtual'

const ROW_HEIGHT = 34
const OVERSCAN = 8

/**
 * Windowed rendering: the whole point of the tool is to surface tens of
 * thousands of clips, which no browser will lay out as real DOM rows.
 */
export interface ClipTableProps {
  clips: Clip[]
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  deselected: ReadonlySet<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
}

export function ClipTable({
  clips,
  emptyMessage,
  emptyAction,
  deselected,
  onToggle,
  onToggleAll,
}: ClipTableProps) {
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

  const onScroll = useCallback(() => setScrollTop(scrollerRef.current?.scrollTop ?? 0), [])

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
            aria-label={state === 'all' ? 'Tout décocher' : 'Tout cocher'}
          />
        </span>
        <span className="col-views">Vues</span>
        <span className="col-date">Date</span>
        <span className="col-title">Titre</span>
        <span className="col-author">Créateur</span>
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
              <div className="table-row" role="row" key={clip.id} style={{ height: ROW_HEIGHT }}>
                <span className="col-pick">
                  <input
                    type="checkbox"
                    checked={!deselected.has(clip.id)}
                    onChange={() => onToggle(clip.id)}
                    aria-label={clip.title || 'Clip sans titre'}
                  />
                </span>
                <span className={clip.view_count === 0 ? 'col-views zero' : 'col-views'}>
                  {clip.view_count}
                </span>
                <span className="col-date">{clip.created_at.slice(0, 10)}</span>
                <span className="col-title">
                  <a href={clip.url} target="_blank" rel="noreferrer" title={clip.title}>
                    {clip.title || '(sans titre)'}
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
