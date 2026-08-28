import { useState } from 'react'

import { formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { MessageKey } from '../i18n/messages.fr'
import type { WindowReport } from '../twitch/clips'
import type { Span } from '../twitch/windows'

/**
 * The strip of slices: one bar per window the search queried, as tall as what
 * it brought back.
 *
 * Evenly wide, whatever the slice lasted. It used to be a chart against a time
 * axis — slabs placed by date, a graduated well, decade rules labelled 1 to
 * 1 k — and the design draws a strip. What that trades away is the ability to
 * read a height as a figure, and what pays for it is the readout underneath:
 * the strip says which slice is fuller, the readout says by how much, exactly,
 * for the one under the pointer.
 *
 * The scale is still logarithmic, because the range is: a slice comes back with
 * three clips or with a thousand, and a linear strip would draw every one of
 * them as the same sliver under a single spike.
 */

/** A slice that found nothing still leaves a mark: it was explored. */
const FLOOR = 12
/** Per decade, in percent of the strip. Four decades fill it. */
const DECADE = 22

const barHeight = (clipCount: number) => Math.min(100, FLOOR + Math.log10(clipCount + 1) * DECADE)

type Kind = 'done' | 'split' | 'lost'

const KIND_LABEL: Record<Kind, MessageKey> = {
  done: 'timeline.kind.done',
  split: 'timeline.kind.split',
  lost: 'timeline.kind.lost',
}

const kindOf = (report: WindowReport): Kind =>
  report.saturated ? (report.split ? 'split' : 'lost') : 'done'

export function Timeline({ reports, span }: { reports: WindowReport[]; span: Span | null }) {
  const { locale, t } = useTranslation()
  // Presentational only: which bar the pointer is over, so its numbers land in
  // the readout instead of staying locked inside a `title` attribute.
  const [hovered, setHovered] = useState<WindowReport | null>(null)

  // Nothing to plot rather than an empty plot: a strip of no bars is a drawing
  // of nothing, where a line can say what will appear there.
  if (!span || span.to <= span.from || reports.length === 0) {
    return (
      <figure className="chart">
        <p className="timeline-empty">{t('timeline.empty')}</p>
      </figure>
    )
  }

  return (
    <figure className="chart">
      <div
        className="timeline"
        onPointerLeave={() => setHovered(null)}
        role="img"
        aria-label={t('timeline.plot', {
          n: reports.length,
          from: { day: new Date(span.from).toISOString() },
          to: { day: new Date(span.to).toISOString() },
        })}
      >
        {reports.map((report) => {
          const kind = kindOf(report)

          return (
            <i
              key={`${report.window.startedAt}-${report.depth}`}
              className={hovered === report ? `slab ${kind} active` : `slab ${kind}`}
              style={{ height: `${barHeight(report.clipCount)}%` }}
              onPointerEnter={() => setHovered(report)}
            />
          )
        })}
      </div>

      <figcaption className="chart-readout">
        {hovered ? (
          <>
            <span>
              {formatDay(hovered.window.startedAt, locale)} →{' '}
              {formatDay(hovered.window.endedAt, locale)}
            </span>
            <span className="muted">·</span>
            <span>{t('timeline.clips', { n: hovered.clipCount })}</span>
            <span className="muted">·</span>
            <span className="muted">{t(KIND_LABEL[kindOf(hovered)])}</span>
          </>
        ) : (
          <>
            <span>
              {formatDay(new Date(span.from).toISOString(), locale)} →{' '}
              {formatDay(new Date(span.to).toISOString(), locale)}
            </span>
            <span className="muted">·</span>
            <span className="muted">{t('timeline.hint', { n: reports.length })}</span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
