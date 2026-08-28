import { useEffect, useRef } from 'react'

import type { LogEntry } from '../domain/log'
import { describeSearchResume } from '../domain/results'
import { useTranslation } from '../i18n/LocaleProvider'
import type { WindowReport } from '../twitch/clips'
import type { Progress } from '../twitch/types'
import type { Span } from '../twitch/windows'
import { Timeline } from './Timeline'
import { CaretIcon } from './Icon'

export interface TechnicalDetailsProps {
  reports: WindowReport[]
  span: Span | null
  progress: Progress | null
  logEntries: LogEntry[]
}

/**
 * How the search went about it: the timeline, the counters and the log.
 *
 * Folded by default and always on screen, under the toolbar — it is its own
 * control, and a second button to open what is already in view would be a
 * control too many. That is also why the fold carries its own summary rather
 * than a list of what it contains: a drawer that says nothing until it is opened
 * has to be opened before it can be judged, which is a thing one does once and
 * never again.
 *
 * It answers "how", a question that only matters when something is off. The
 * verdict on whether the result is whole is not in here: that one belongs above,
 * beside the count it qualifies.
 */
export function TechnicalDetails({ reports, span, progress, logEntries }: TechnicalDetailsProps) {
  const { t } = useTranslation()
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logEntries])

  const split = reports.filter((report) => report.split).length
  const resume = describeSearchResume({ progress, split }, t)

  return (
    /* Deliberately uncontrolled: React must never close again what the user has
       just opened. */
    <details className="technical">
      <summary>
        <CaretIcon />
        {t('progress.details')}
        <span className="summary-aside">{resume ?? t('progress.detailsAside')}</span>
      </summary>

      {/* Three things and no headings over them: a timeline is recognised as a
          timeline, and a column of monospaced lines as a log. The counts that
          used to sit between them — slices and requests — are the very two the
          banner above carries, so the drawer said, to whoever had opened it,
          what it had just finished saying to whoever had not. */}
      <div className="technical-body">
        <Timeline reports={reports} span={span} />
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

        <div className="log" ref={logRef}>
          {logEntries.length === 0 ? (
            <p>{t('progress.logEmpty')}</p>
          ) : (
            logEntries.map((entry) => (
              <p key={entry.id} className={entry.kind}>
                {/* Rendered here rather than where it was written: a search
                    outlives the language it started in. */}
                {entry.say(t)}
              </p>
            ))
          )}
        </div>
      </div>
    </details>
  )
}
