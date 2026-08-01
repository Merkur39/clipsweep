import type { WindowReport } from '../twitch/clips'

export interface Span {
  from: number
  to: number
}

/**
 * Timeline of the search: one slab per queried window, height scaled on the
 * clips found. Split slabs mark the spans that saturated and got halved.
 */
export function Frieze({ reports, span }: { reports: WindowReport[]; span: Span | null }) {
  if (!span || span.to <= span.from) {
    return (
      <div className="frieze">
        <p className="frieze-empty">
          Chaque fenêtre explorée apparaîtra ici, sa hauteur donnant le nombre de clips.
        </p>
      </div>
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

  return (
    <div className="frieze">
      {reports.map((report) => {
        const left = pct(Date.parse(report.window.startedAt))
        const width = Math.max(pct(Date.parse(report.window.endedAt)) - left, 0.25)
        const height = Math.min(150, 4 + Math.log10(report.clipCount + 1) * 48)
        const kind = report.saturated ? (report.split ? 'split' : 'lost') : 'done'

        return (
          <div
            key={`${report.window.startedAt}-${report.depth}`}
            className={`slab ${kind}`}
            style={{ left: `${left}%`, width: `${width}%`, height }}
            title={`${report.window.startedAt.slice(0, 10)} → ${report.window.endedAt.slice(0, 10)} · ${report.clipCount} clips`}
          />
        )
      })}

      <div className="axis">
        {years.map((year, index) => {
          const time = Date.UTC(year, 0, 1)
          if (index % stride || time < span.from || time > span.to) return null
          return (
            <span className="tick" key={year} style={{ left: `${pct(time)}%` }}>
              {year}
            </span>
          )
        })}
      </div>
    </div>
  )
}
