import { useState } from 'react'

import { formatCount } from '../domain/numbers'
import type { WindowReport } from '../twitch/clips'
import { axisTicks } from './axis'

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
/** En part de la période : en deçà, une dalle deviendrait invisible. */
const MIN_SLAB_WIDTH = 0.25

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
  const ticks = axisTicks(span.from, span.to)

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
          {ticks.map((tick) => (
            <div key={tick.time} className="frieze-year" style={{ left: `${pct(tick.time)}%` }} />
          ))}

          {reports.map((report) => {
            const start = pct(Date.parse(report.window.startedAt))
            const end = pct(Date.parse(report.window.endedAt))
            const kind = kindOf(report)

            /*
             * Bord droit posé par `right`, et non par `width`.
             *
             * Le navigateur résout chaque pourcentage séparément et arrondit au
             * 1/64 de pixel : `left + width` peut retomber un cran avant le
             * `left` du voisin, et ce cheveu d'écart laisse voir le fond entre
             * deux périodes contiguës. Mesuré sur une fouille de neuf ans :
             * trois joints sur huit s'ouvraient ainsi. Exprimé par `right`, le
             * bord partagé vient du même pourcentage des deux côtés.
             *
             * Une période trop courte pour être vue garde un plancher de
             * largeur : là, le joint importe moins que l'existence de la dalle.
             */
            const edges =
              end - start >= MIN_SLAB_WIDTH
                ? { left: `${start}%`, right: `${100 - end}%` }
                : { left: `${start}%`, width: `${MIN_SLAB_WIDTH}%` }

            return (
              <div
                key={`${report.window.startedAt}-${report.depth}`}
                className={hovered === report ? `slab ${kind} active` : `slab ${kind}`}
                style={{ ...edges, height: slabHeight(report.clipCount) }}
                onPointerEnter={() => setHovered(report)}
              />
            )
          })}

          {running && last && <div className="frieze-pen" style={{ left: `${penLeft}%` }} />}
        </div>

        <div className="frieze-axis">
          {ticks.map((tick) => (
            <span className="tick" key={tick.time} style={{ left: `${pct(tick.time)}%` }}>
              {tick.label}
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
          // La période est énoncée ici, et non aux bouts de l'axe où son
          // étiquette chevaucherait le 1er janvier voisin. C'est aussi ce qui
          // explique les colonnes de bord plus étroites : la fouille commence
          // et finit rarement un 1er janvier.
          <>
            <span>
              {day(new Date(span.from).toISOString())} → {day(new Date(span.to).toISOString())}
            </span>
            <span className="muted">·</span>
            <span className="muted">
              {reports.length} période(s) · survole pour le détail · hauteur logarithmique
            </span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
