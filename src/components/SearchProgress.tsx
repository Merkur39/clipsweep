import { useEffect, useRef } from 'react'

import type { LogEntry } from '../domain/log'
import { describeSearchStatus } from '../domain/results'
import { formatCount } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
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
 * The sweep's progress. A status line is enough for most visitors; the frieze
 * and the log answer "how the algorithm went about it", a question that only
 * matters when something is off — hence the fold. The completeness alert stays
 * outside: it is not a technical detail but a verdict on the result's validity.
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
  const { locale, t } = useTranslation()
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logEntries])

  const status = describeSearchStatus({ running, progress, clipsFound }, t)

  return (
    <section className="progress-block">
      {status && <p className={running ? 'search-status running' : 'search-status'}>{status}</p>}

      {incomplete.length > 0 && (
        <p className="alert">
          <AlertIcon />
          <span>{t('progress.incomplete', { n: incomplete.length })}</span>
        </p>
      )}

      {/* Deliberately uncontrolled: React must never close again what the user
          has just opened. */}
      <details className="technical">
        <summary>
          <CaretIcon />
          {t('progress.details')}
          <span className="summary-aside">{t('progress.detailsAside')}</span>
        </summary>

        <p className="section-label">{t('progress.timeSplit')}</p>
        <Frieze reports={reports} span={span} running={running} />
        <div className="legend">
          <span>
            <b className="done" />
            {t('progress.legend.done')}
          </span>
          <span>
            <b className="split" />
            {t('progress.legend.split')}
          </span>
          <span>
            <b className="lost" />
            {t('progress.legend.lost')}
          </span>
        </div>

        <dl className="tally">
          <div>
            <dt>{t('progress.periods')}</dt>
            <dd>
              {progress
                ? `${formatCount(progress.windowsDone, locale)}/${formatCount(progress.windowsTotal, locale)}`
                : '0'}
            </dd>
          </div>
          <div>
            <dt>{t('progress.requests')}</dt>
            <dd>{formatCount(progress?.requests ?? 0, locale)}</dd>
          </div>
        </dl>

        <p className="section-label">{t('progress.log')}</p>
        <div className="log" ref={logRef}>
          {logEntries.length === 0 ? (
            <p>{t('progress.logEmpty')}</p>
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
