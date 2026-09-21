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
  const wholeShare = periodMs > 0 ? coveredMs / periodMs : 0

  /**
   * The second pass, which is where the wait actually is.
   *
   * It costs nine requests out of ten and brings back next to nothing — 0 clips
   * of 261 on `vinc33x`, 1 of 91 on `noxya__`, measured on 2026-09-21. The
   * reader has their table by then, so the block stops being the subject of the
   * screen and becomes a line at the foot of it.
   *
   * And it is the one stretch that can be drawn as a fraction: `coveredMs` only
   * moves when a window closes, so over the single window a sweep now seeds it
   * says nought from the first request to the last. The pass, itself, knows
   * what it costs.
   */
  const verifying = running && progress?.pass === 'narrow'
  /**
   * A halved slice re-reading the top of the span its parent already covered.
   *
   * Helix paginates by view count and a cursor belongs to the query that made
   * it, so a half starts again from the top and its first pages hand back what
   * the parent already had. `clipsFound` is a set's size, so it stands
   * perfectly still — measured on 2026-09-21 over `kaliyami`, 48 % of the wide
   * pass, in stretches of two to seven seconds.
   *
   * Two pages, not one: a page adding nothing is ordinary — a page of twenty
   * against a catalogue of thousands often lands entirely inside what is held —
   * and a line that appeared for every one of them would flicker rather than
   * inform. A run of two means the overlap.
   *
   * It yields to a pause, and that is not a detail of taste. Both say Twitch is
   * holding things up, and they sit two lines apart in the same block — but
   * only one of them names a delay Twitch is actually imposing, with a
   * countdown and a promise to resume. A reader who has met the wording nine
   * times without consequence has nothing left to recognise the real quota by,
   * so the pass that waits on nothing gives the word back to the one that does.
   */
  const rereading = running && !verifying && pausedFor === null && (progress?.stalePages ?? 0) >= 2
  const passShare =
    verifying && progress.passTotal ? Math.min(1, progress.passDone / progress.passTotal) : null
  const share = passShare ?? wholeShare

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
  // Re-reading counts as seeking: the fill cannot move while the ground under
  // it is ground already credited, and a bar frozen at a fraction says less
  // than one that admits it cannot measure this stretch.
  const seeking = share === 0 || rereading

  return (
    <div
      className="run-slot"
      data-open={running ? '' : undefined}
      data-compact={verifying ? '' : undefined}
      inert={!running}
    >
      <section className="run">
        {/* Verifying, the head is one line and the figure is not in it: the
          ticket three centimetres above carries the same count in the same
          words, and two readouts of one number is one too many. What is left to
          say is what is being done, so that is all it says.

          The pause outranks it, here as above: it displaces what the search was
          doing rather than sitting beside it, the counters having stopped
          moving, and a line still reciting them is the very thing that reads as
          a hang. */}
        <div className="run-head">
          {verifying ? (
            <p className={pausedFor === null ? 'run-say' : 'run-say is-paused'}>
              {pausedFor === null ? t('run.verifying') : t('run.paused', { n: pausedFor })}
            </p>
          ) : (
            <>
              <p className="run-figure">
                <span className="run-count">{formatCount(clipsFound, locale)}</span>
                {/* The reason rides on the unit rather than replacing the
                  figure. The count is still true — that many clips have been
                  found — and it is the still number that raises the question,
                  so the answer belongs beside it. Replacing it would have taken
                  it off screen and put it back some nine times a search, twice
                  for under three seconds. */}
                <span className="run-unit">
                  {t('run.found', { n: clipsFound })}
                  {rereading ? ` — ${t('run.rereading')}` : ''}
                </span>
              </p>

              {pausedFor === null ? (
                <p className="run-say">{t('run.say')}</p>
              ) : (
                <p className="run-say is-paused">{t('run.paused', { n: pausedFor })}</p>
              )}
            </>
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

        {/* The slice count and the estimate belong to the pass that walks the
          period. The second one walks the same window over again, so "0 of 1"
          and a time left computed on ground that cannot move are two readings
          of nothing — the drawer below keeps both, where slices still mean
          something. */}
        {verifying ? null : (
          <div className="run-foot">
            <span>{foot}</span>
          </div>
        )}
      </section>
    </div>
  )
}
