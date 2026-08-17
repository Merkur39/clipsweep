import { useState } from 'react'

import { formatCount } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { WindowReport } from '../twitch/clips'
import type { Progress } from '../twitch/types'
import { Icon } from './Icon'

export interface SweepBannerProps {
  progress: Progress | null
  /** The deduplicated count, which is what the table shows — not Helix's tally. */
  clipsFound: number
  /** Only the last one is read: it is the period the recorder has just written. */
  reports: WindowReport[]
}

/**
 * The ring's geometry, kept here rather than in the sheet: an SVG circle is
 * dashed in user units, and the dash length is the only way to draw an arc.
 * Radius and stroke come from the catalogue's small ring (44px box).
 */
const RING_BOX = 44
const RING_RADIUS = 18
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * The floating readout of a running sweep.
 *
 * Pinned over the work surface rather than laid in the flow: a sweep runs for a
 * minute or more, and its progress has to stay readable wherever the page has
 * been scrolled to. It overlays instead of pushing — a banner that displaced the
 * table would move every row the moment it appeared and again when it left.
 *
 * Rendered only while a sweep runs; the caller is what decides that, so there is
 * no `running` here to disagree with it.
 */
export function SweepBanner({ progress, clipsFound, reports }: SweepBannerProps) {
  const { t } = useTranslation()
  /*
   * Folded state is the visitor's, and it is kept: a new sweep does not unfold
   * the banner again. Someone who tidied it away asked for the work surface, not
   * for a readout that comes back on its own — and the hairline still reports,
   * so nothing is hidden by honouring the choice.
   */
  const [tidy, setTidy] = useState(false)

  if (!progress) return null

  const { windowsDone, windowsTotal } = progress
  const done = windowsTotal > 0 ? windowsDone / windowsTotal : 0
  const percent = Math.round(done * 100)
  /*
   * The period just written, not the one in flight: a window is only reported
   * once it has been walked to its end, and announcing a period the sweep has
   * not finished would put a figure on screen that nothing can yet confirm. It
   * is the same instant the frieze's stylus marks.
   */
  const written = reports.at(-1)?.window ?? null

  if (tidy) {
    return (
      <button
        className="mini"
        type="button"
        aria-label={t('sweep.reopen')}
        onClick={() => setTidy(false)}
      >
        {/* Slid, never resized — same reason as the full bar below. */}
        <i style={{ transform: `translateX(-${100 - percent}%)` }} />
      </button>
    )
  }

  return (
    <div className="float" role="group" aria-label={t('sweep.label')}>
      <span className="ring sm">
        <svg width={RING_BOX} height={RING_BOX} viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}>
          <circle
            cx={RING_BOX / 2}
            cy={RING_BOX / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--surface-hover)"
            strokeWidth="5"
          />
          {/* The second dash is a length no arc can reach, which is how a single
              `stroke-dasharray` draws one arc and no repeat of it. */}
          <circle
            cx={RING_BOX / 2}
            cy={RING_BOX / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--accent-mark)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(RING_CIRCUMFERENCE * done).toFixed(1)} 999`}
          />
        </svg>
        <span className="pct">{t('sweep.percent', { n: percent })}</span>
      </span>

      <div className="runtext">
        <RunHeading done={windowsDone} total={windowsTotal} clips={clipsFound} />
        {/*
         * The fill is always full width and is slid with `translateX`: resizing
         * it would put a layout pass on the one element that moves while rows
         * are appending to the table. It is also what keeps the leading cap
         * round — a width animation would compress the radius against the edge.
         */}
        <div className="track">
          <i style={{ transform: `translateX(-${100 - percent}%)` }} />
        </div>
        {/* Always rendered, empty or not — the sheet holds its line open, so the
            first report does not lift the whole banner by a line's height. */}
        <span className="meta">
          {written
            ? t('sweep.window', {
                from: { day: written.startedAt },
                to: { day: written.endedAt },
              })
            : ''}
        </span>
      </div>

      {/* A chevron, never a cross: closing this must not read as "stop the
          sweep". Stopping lives in the rail, and says so in words. */}
      <button
        className="iconbtn"
        type="button"
        aria-label={t('sweep.tidy')}
        onClick={() => setTidy(true)}
      >
        <Icon name="chevron" turn={180} />
      </button>
    </div>
  )
}

/**
 * The heading, with the ratio set apart in the accent.
 *
 * The sentence comes whole from the catalogue — its wording and its punctuation
 * are the translator's — so the ratio is found back inside the rendered string
 * rather than the sentence being assembled from fragments here. Both languages
 * write `{done}/{total}` adjacent; a translation that did not would simply lose
 * the emphasis, not the sentence.
 */
function RunHeading({ done, total, clips }: { done: number; total: number; clips: number }) {
  const { locale, t } = useTranslation()

  const line = t('results.status.running', { done, total, n: clips })
  const ratio = `${formatCount(done, locale)}/${formatCount(total, locale)}`
  const at = line.indexOf(ratio)

  if (at < 0) return <h4>{line}</h4>

  return (
    <h4>
      {line.slice(0, at)}
      <em>{ratio}</em>
      {line.slice(at + ratio.length)}
    </h4>
  )
}
