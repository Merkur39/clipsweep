import { useEffect, useRef } from 'react'

import type { LogEntry } from '../domain/log'
import type { WindowReport } from '../twitch/clips'
import type { Progress } from '../twitch/types'
import { Frieze, type Span } from './Frieze'

export interface SearchProgressProps {
  reports: WindowReport[]
  span: Span | null
  progress: Progress | null
  incomplete: WindowReport[]
  clipsFound: number
  selectedCount: number
  logEntries: LogEntry[]
}

/** What the search is doing, while it does it: timeline, counters, journal. */
export function SearchProgress({
  reports,
  span,
  progress,
  incomplete,
  clipsFound,
  selectedCount,
  logEntries,
}: SearchProgressProps) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logEntries])

  return (
    <>
      <p className="eyebrow">Découpage du temps</p>
      <Frieze reports={reports} span={span} />
      <div className="legend">
        <span>
          <b className="done" />
          fenêtre complète
        </span>
        <span>
          <b className="split" />
          saturée, recoupée
        </span>
        <span>
          <b className="lost" />
          saturée au plancher — clips manquants
        </span>
      </div>

      <dl className="tally">
        <div>
          <dt>Fenêtres</dt>
          <dd>{progress ? `${progress.windowsDone}/${progress.windowsTotal}` : '0'}</dd>
        </div>
        <div>
          <dt>Requêtes</dt>
          <dd>{progress?.requests ?? 0}</dd>
        </div>
        <div>
          <dt>Clips uniques</dt>
          <dd>{clipsFound || progress?.clipsFound || 0}</dd>
        </div>
        <div>
          <dt>Sélectionnés</dt>
          <dd>{selectedCount}</dd>
        </div>
      </dl>

      {incomplete.length > 0 && (
        <p className="alert">
          {incomplete.length} fenêtre(s) encore saturée(s) au plancher de 6 h : le résultat n'est
          pas exhaustif sur ces périodes. Resserre l'intervalle de dates.
        </p>
      )}

      <p className="eyebrow">Journal</p>
      <div className="log" ref={logRef}>
        {logEntries.length === 0 ? (
          <p>En attente.</p>
        ) : (
          logEntries.map((entry) => (
            <p key={entry.id} className={entry.kind}>
              {entry.text}
            </p>
          ))
        )}
      </div>
    </>
  )
}
