import { describeRunProgress } from '../domain/results'
import { useCountdown } from '../hooks/useCountdown'
import { formatCount } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Progress } from '../twitch/types'

export interface SearchRunProps {
  progress: Progress | null
  /** While Twitch is asking the search to wait; see `useClipSearch`. */
  pausedUntil: number | null
  /**
   * Deduplicated, so it is the number the table will hold. Taken live from the
   * search rather than from the table, which lags it by a whole slice — see
   * where it is computed, in `App`, alongside the ticket that says the same
   * number in the same words.
   */
  clipsFound: number
  running: boolean
  /** How long the search has been going, sampled with `progress`. */
  elapsedMs: number
}

/**
 * What the search says while it runs: the count climbing, a bar, and how much
 * of the period is behind it.
 *
 * A search runs from a few seconds to several minutes, and what it says during
 * that time is the whole of what stands between "it is working" and "it has
 * hung". So it is drawn as the subject of the screen — one figure, at the size
 * of a figure that matters — rather than as a sentence above a table.
 *
 * Nothing at all once it is over: the ticket above states the channel, the
 * period and the count. Two readouts of one number, three centimetres apart, is
 * one too many.
 *
 * But it **folds** rather than unmounting, and the difference is a hundred and
 * fifty pixels: leaving the flow between one frame and the next takes the
 * toolbar and the first rows of the readout up with it, twice per search — once
 * on the way in, once on the way out. So the block stays in the page and the
 * slot around it collapses, which is a thing CSS can carry from one height to
 * the other. Folded, the slot is `inert`: it has no tab stop and nothing for a
 * screen reader to recite about a search that is over.
 *
 * What it holds while folding shut is the last state of the search — the final
 * count, the full bar — which is the right thing to watch go.
 */
export function SearchRun({
  progress,
  pausedUntil,
  clipsFound,
  running,
  elapsedMs,
}: SearchRunProps) {
  const { locale, t } = useTranslation()
  // Above every guard on `progress`, and deliberately: a pause can fall on the
  // very first request, which leaves nothing to report and is the longest
  // silence of the lot.
  const pausedFor = useCountdown(running ? pausedUntil : null)

  const done = progress?.windowsDone ?? 0
  const total = progress?.windowsTotal ?? 0
  const coveredMs = progress?.coveredMs ?? 0
  const periodMs = progress?.periodMs ?? 0
  const foot = describeRunProgress({ done, total, coveredMs, periodMs, elapsedMs }, t)

  /**
   * How much of the period is behind the search — which is what the bar has
   * always claimed to draw, and now the number it actually draws.
   *
   * It used to be the slices behind over the slices in all, and that fraction
   * could go DOWN: every saturated window is halved into two more, so the
   * denominator grows, and `(d + 1) / (T + 2)` is smaller than `d / T` whenever
   * `T < 2d` — past the halfway mark, which is where dense recent years land.
   * With a 240ms transition on the fill, the bar did not glitch backwards, it
   * slid backwards, at the speed it had been going forwards.
   *
   * The period cannot do that. Halves tile their parent exactly, so a split
   * moves no ground instead of negative ground, and the sum closes on the whole
   * period at the last slice.
   */
  const share = periodMs > 0 ? coveredMs / periodMs : 0

  // Nothing has come back that would make a fraction — the channel is still
  // being resolved, the first slice is still being walked, or that slice turned
  // out to need halving and covered nothing. Drawing the bar at nought is worse
  // than not drawing it: the sheen that says "alive" lives *inside* the filled
  // part, which is nought pixels wide for exactly as long as it is the only
  // thing saying so. So the bar declares itself indeterminate, a state ARIA
  // spells by the absence of `aria-valuenow`.
  //
  // Read off `share` and not off the slice count, so that it is the same
  // measure the fill uses: the hatch and the sheen then cannot both be on
  // screen, by arithmetic rather than by luck.
  const seeking = share === 0

  return (
    <div className="run-slot" data-open={running ? '' : undefined} inert={!running}>
      <section className="run">
        <div className="run-head">
          <p className="run-figure">
            <span className="run-count">{formatCount(clipsFound, locale)}</span>
            <span className="run-unit">{t('run.found', { n: clipsFound })}</span>
          </p>

          {/* The pause displaces what the search was doing rather than sitting
            beside it: the counters have stopped moving, and a line still
            reciting them is the very thing that reads as a hang. */}
          {pausedFor === null ? (
            <p className="run-say">{t('run.say')}</p>
          ) : (
            <p className="run-say is-paused">{t('run.paused', { n: pausedFor })}</p>
          )}
        </div>

        {/* Linear, and it has to be: a curve would lie about the rate at which
          the period is actually being covered. */}
        <div
          className="run-bar"
          /* The look is gated on `running` as well, like the countdown above:
            it animates, and a search that is over must animate nothing — least
            of all behind a block the fold has taken down to no height. What it
            reports stays true either way. */
          data-indeterminate={running && seeking ? '' : undefined}
          role="progressbar"
          /* A hundredth of the period, on a scale of a hundred — where the
            maximum used to be the slice total, and the slice total moves: a bar
            announced as "47 of 96" and then as "48 of 98" asks the listener to
            re-learn the scale mid-search to know whether it advanced. */
          aria-valuenow={seeking ? undefined : Math.round(share * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* The unrounded share, so the fill is not quantised to whole
            percents while the number beside it is. */}
          <i style={{ inlineSize: `${share * 100}%` }} />
        </div>

        <div className="run-foot">
          <span>{foot}</span>
        </div>
      </section>
    </div>
  )
}
