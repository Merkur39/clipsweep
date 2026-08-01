import { useEffect, useRef } from 'react'

import type { LogEntry } from '../domain/log'
import { formatCount } from '../domain/numbers'
import { describeSearchStatus } from '../domain/results'
import type { WindowReport } from '../twitch/clips'
import type { Progress } from '../twitch/types'
import { Frieze, type Span } from './Frieze'
import { AlertIcon, CaretIcon } from './Icon'

export interface SearchProgressProps {
  reports: WindowReport[]
  span: Span | null
  progress: Progress | null
  incomplete: WindowReport[]
  clipsFound: number
  logEntries: LogEntry[]
  running: boolean
}

/**
 * L'avancement de la fouille. Une ligne d'état suffit à la plupart des
 * visiteurs ; la frise et le journal répondent à « comment l'algorithme a
 * procédé », question qui n'intéresse que si quelque chose cloche — d'où le
 * repli. L'alerte d'exhaustivité reste dehors : ce n'est pas un détail
 * technique mais un constat sur la validité du résultat.
 */
export function SearchProgress({
  reports,
  span,
  progress,
  incomplete,
  clipsFound,
  logEntries,
  running,
}: SearchProgressProps) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logEntries])

  const status = describeSearchStatus({ running, progress, clipsFound })

  return (
    <section className="progress-block">
      {status && <p className={running ? 'search-status running' : 'search-status'}>{status}</p>}

      {incomplete.length > 0 && (
        <p className="alert">
          <AlertIcon />
          <span>
            {incomplete.length} période(s) n'ont pas pu être explorées entièrement : il manque des
            clips sur celles-ci. Resserre l'intervalle de dates.
          </span>
        </p>
      )}

      {/* Non contrôlé volontairement : React ne doit jamais refermer ce que
          l'utilisateur vient d'ouvrir. */}
      <details className="technical">
        <summary>
          <CaretIcon />
          Détail de la fouille
          <span className="summary-aside">frise, compteurs, journal</span>
        </summary>

        <p className="section-label">Découpage du temps</p>
        <Frieze reports={reports} span={span} running={running} />
        <div className="legend">
          <span>
            <b className="done" />
            période complète
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
            <dt>Périodes</dt>
            <dd>
              {progress
                ? `${formatCount(progress.windowsDone)}/${formatCount(progress.windowsTotal)}`
                : '0'}
            </dd>
          </div>
          <div>
            <dt>Requêtes</dt>
            <dd>{formatCount(progress?.requests ?? 0)}</dd>
          </div>
        </dl>

        <p className="section-label">Journal</p>
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
      </details>
    </section>
  )
}
