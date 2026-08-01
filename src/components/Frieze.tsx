import { useState } from 'react'

import { formatCount } from '../domain/numbers'
import type { WindowReport } from '../twitch/clips'

export interface Span {
  from: number
  to: number
}

/**
 * Timeline of the search: one slab per queried window, height scaled on the
 * clips found. Split slabs mark the spans that saturated and got halved.
 *
 * The height is logarithmic, so the chart is unreadable without its graticule:
 * two slabs of visibly different height can be 100 or 10 000 clips. The decade
 * rules and their labels are half the information, not decoration.
 */

const PLOT_HEIGHT = 176
/** A window that found nothing still leaves a mark on the paper. */
const BASELINE = 4
/**
 * One decade per 52px. A single window tops out around the API's 1000-result
 * ceiling, so the scale is sized on that: a taller decade step would leave the
 * top third of the paper permanently blank.
 */
const DECADE = 52
const CEILING = PLOT_HEIGHT - 6

const slabHeight = (clipCount: number) =>
  Math.min(CEILING, BASELINE + Math.log10(clipCount + 1) * DECADE)

const DECADES = [
  { value: 1, label: '1' },
  { value: 10, label: '10' },
  { value: 100, label: '100' },
  { value: 1000, label: '1 k' },
]

type Kind = 'done' | 'split' | 'lost'

const KIND_LABEL: Record<Kind, string> = {
  done: 'complète',
  split: 'saturée, recoupée',
  lost: 'saturée au plancher — clips manquants',
}

const kindOf = (report: WindowReport): Kind =>
  report.saturated ? (report.split ? 'split' : 'lost') : 'done'

const day = (iso: string) => iso.slice(0, 10)

export function Frieze({
  reports,
  span,
  running = false,
}: {
  reports: WindowReport[]
  span: Span | null
  running?: boolean
}) {
  // Presentational only: which slab the pointer is over, so its numbers land in
  // the readout instead of staying locked inside a `title` attribute.
  const [hovered, setHovered] = useState<WindowReport | null>(null)

  if (!span || span.to <= span.from) {
    return (
      <figure className="chart">
        <div className="frieze">
          <p className="frieze-empty">
            Chaque période explorée apparaîtra ici, sa hauteur donnant le nombre de clips.
          </p>
        </div>
      </figure>
    )
  }

  const pct = (time: number) => ((time - span.from) / (span.to - span.from)) * 100
  const years: number[] = []
  for (
    let year = new Date(span.from).getUTCFullYear();
    year <= new Date(span.to).getUTCFullYear();
    year += 1
  ) {
    years.push(year)
  }
  const stride = Math.ceil(years.length / 8) || 1
  const ticks = years.filter(
    (year, index) =>
      index % stride === 0 && Date.UTC(year, 0, 1) >= span.from && Date.UTC(year, 0, 1) <= span.to,
  )

  const last = reports.at(-1)
  const penLeft = last ? pct(Date.parse(last.window.endedAt)) : 0

  return (
    <figure className="chart">
      <div className="frieze">
        <div className="frieze-scale" aria-hidden="true">
          {DECADES.map((decade) => (
            <span
              key={decade.value}
              className="frieze-decade-label"
              style={{ bottom: slabHeight(decade.value) }}
            >
              {decade.label}
            </span>
          ))}
        </div>

        <div
          className="frieze-plot"
          onPointerLeave={() => setHovered(null)}
          role="img"
          aria-label={`Découpage du temps : ${reports.length} période(s) explorée(s) entre ${day(new Date(span.from).toISOString())} et ${day(new Date(span.to).toISOString())}.`}
        >
          {DECADES.map((decade) => (
            <div
              key={decade.value}
              className="frieze-decade"
              style={{ bottom: slabHeight(decade.value) }}
            />
          ))}
          {ticks.map((year) => (
            <div
              key={year}
              className="frieze-year"
              style={{ left: `${pct(Date.UTC(year, 0, 1))}%` }}
            />
          ))}

          {reports.map((report) => {
            const left = pct(Date.parse(report.window.startedAt))
            const width = Math.max(pct(Date.parse(report.window.endedAt)) - left, 0.25)
            const kind = kindOf(report)

            return (
              <div
                key={`${report.window.startedAt}-${report.depth}`}
                className={hovered === report ? `slab ${kind} active` : `slab ${kind}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  height: slabHeight(report.clipCount),
                }}
                onPointerEnter={() => setHovered(report)}
              />
            )
          })}

          {running && last && <div className="frieze-pen" style={{ left: `${penLeft}%` }} />}
        </div>

        <div className="frieze-axis">
          {ticks.map((year) => (
            <span className="tick" key={year} style={{ left: `${pct(Date.UTC(year, 0, 1))}%` }}>
              {year}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="chart-readout">
        {hovered ? (
          <>
            <span>
              {day(hovered.window.startedAt)} → {day(hovered.window.endedAt)}
            </span>
            <span className="muted">·</span>
            <span>{formatCount(hovered.clipCount)} clips</span>
            <span className="muted">·</span>
            <span className="muted">{KIND_LABEL[kindOf(hovered)]}</span>
          </>
        ) : (
          <span className="muted">
            Survole une période pour ses dates et son décompte. Hauteur logarithmique.
          </span>
        )}
      </figcaption>
    </figure>
  )
}
