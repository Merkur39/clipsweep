import { useCallback, useEffect, useRef, useState } from 'react'

import type { Clip } from '../twitch/types'
import { visibleRange } from './virtual'

const ROW_HEIGHT = 34
const OVERSCAN = 8

/**
 * Windowed rendering: the whole point of the tool is to surface tens of
 * thousands of clips, which no browser will lay out as real DOM rows.
 */
export function ClipTable({ clips }: { clips: Clip[] }) {
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
        <span className="col-views">Vues</span>
        <span className="col-date">Date</span>
        <span className="col-title">Titre</span>
        <span className="col-author">Créateur</span>
      </div>

      <div className="table-body" ref={scrollerRef} onScroll={onScroll} role="rowgroup">
        <div style={{ height: clips.length * ROW_HEIGHT, position: 'relative' }}>
          <div style={{ position: 'absolute', top: firstIndex * ROW_HEIGHT, left: 0, right: 0 }}>
            {slice.map((clip) => (
              <div className="table-row" role="row" key={clip.id} style={{ height: ROW_HEIGHT }}>
                <span className={clip.view_count === 0 ? 'col-views zero' : 'col-views'}>{clip.view_count}</span>
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
