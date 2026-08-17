import { useEffect, useMemo, useRef, useState } from 'react'

import type { LogEntry, LogKind } from '../domain/log'
import { formatCount, formatElapsed } from '../i18n/format'
import type { Locale } from '../i18n/locales'
import { useTranslation } from '../i18n/LocaleProvider'
import type { T } from '../i18n/translate'
import type { WindowReport } from '../twitch/clips'
import type { Clip, Progress } from '../twitch/types'
import { Frieze, type Span } from './Frieze'
import { Icon } from './Icon'
import { barScale, barWidth, rankClips, type Ranking } from './ranking'

export interface SearchProgressProps {
  reports: WindowReport[]
  span: Span | null
  progress: Progress | null
  incomplete: WindowReport[]
  /**
   * The pre-filter total. Nothing in the drawer reads it any more — the banner
   * reports it while the sweep runs and the results head once it is done — but
   * it stays on the signature: it is the count this section was built around,
   * and dropping it would silently change the integrator's call.
   */
  clipsFound: number
  logEntries: LogEntry[]
  running: boolean
  /** The rankings are counted off the clips themselves — nothing else has them. */
  clips: readonly Clip[]
  /** The same mapper the filters use, so a category reads alike in both places. */
  gameLabel: (id: string) => string
  elapsedMs: number | null
}

/** A creator is already its own label; only games have to be looked up. */
const identity = (value: string) => value

/**
 * What the rankings are while the drawer is shut. A module-level constant, not
 * a fresh `{ rows: [], total: 0 }` per render: the memo's whole purpose is to
 * return the same reference when nothing is being asked of it.
 */
const EMPTY_RANKING: Ranking = { rows: [], total: 0 }

/**
 * Longer than `--dur-panel`, which is 240ms. Only a backstop for a close whose
 * transition never reports back; ending it early would cut the animation the
 * closing state exists to permit.
 */
const CLOSE_FALLBACK_MS = 600

/**
 * The log's four kinds, in the sheet's vocabulary. `info` deliberately maps to
 * nothing: it is the running trace, and it takes the log's own ink — only what
 * departs from the trace is coloured.
 */
const LOG_TONE: Record<LogKind, string | undefined> = {
  info: undefined,
  good: 'good',
  warn: 'warn',
  err: 'bad',
}

/**
 * The statistics drawer: how the sweep went about it.
 *
 * Shut by default and never opened on its own — the result is what the page is
 * for, and this answers a question ("how was it fetched?") that only arises once
 * something looks off. The bar stays in both states: one component that opens,
 * not two that replace each other, which is also what lets the chevron's turn be
 * animated and what keeps the drawer from duplicating its own header.
 *
 * The completeness alert is not here: it is a verdict on the whole sweep's
 * validity, not a technical detail, so the integrator sets it at the top of the
 * work area where it is read before the results are.
 */
export function SearchProgress({
  reports,
  span,
  progress,
  incomplete,
  logEntries,
  running,
  clips,
  gameLabel,
  elapsedMs,
}: SearchProgressProps) {
  const { locale, t } = useTranslation()
  const logRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  /**
   * Held true for the length of the closing transition.
   *
   * The panel is not rendered while the drawer is shut — the whole point — but
   * unmounting it on the click that closes it would leave the track with
   * nothing to shrink, and the drawer would snap instead of closing. So the
   * contents outlive the click by exactly one transition.
   */
  const [closing, setClosing] = useState(false)
  const mounted = open || closing

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logEntries])

  useEffect(() => {
    if (!closing) return

    // The transition's own end is the signal; this only covers the cases where
    // it never arrives — a tab backgrounded mid-close, an engine that skips a
    // transition it considers invisible. Generous on purpose: firing early
    // would cut the animation this state exists to allow.
    const timer = setTimeout(() => setClosing(false), CLOSE_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [closing])

  /**
   * The three passes over the whole collection, skipped while the drawer is
   * shut — which is its default and, for most of a sweep, its state.
   *
   * Guarded inside the memo rather than around it: a hook cannot be called
   * conditionally, but the work it wraps can be. `mounted` joins the
   * dependencies, so opening the drawer pays for them once, at the moment
   * someone asks to see them.
   */
  const creators = useMemo(
    () => (mounted ? rankClips(clips, (clip) => clip.creator_name, identity, t) : EMPTY_RANKING),
    [mounted, clips, t],
  )
  const games = useMemo(
    () => (mounted ? rankClips(clips, (clip) => clip.game_id, gameLabel, t) : EMPTY_RANKING),
    [mounted, clips, gameLabel, t],
  )

  const zeroViews = useMemo(
    () => (mounted ? clips.reduce((total, clip) => total + (clip.view_count === 0 ? 1 : 0), 0) : 0),
    [mounted, clips],
  )
  const split = reports.filter((report) => report.split).length

  return (
    <section className="stats-drawer">
      <button
        className="stats-bar"
        type="button"
        aria-expanded={open}
        aria-controls="stats-body"
        onClick={() => {
          if (open) setClosing(true)
          setOpen(!open)
        }}
      >
        {/* The glyph turns on the attribute, not on a swapped class: the chevron
            is the same node in both states, so the turn can be animated. */}
        <span className="chev">
          <Icon name="chevron" />
        </span>
        <b>{t('stats.toggle')}</b>
        <span className="sb-sub">{t('progress.detailsAside')}</span>
        <Peek running={running} progress={progress} split={split} lost={incomplete.length} t={t} />
      </button>

      {/* One grid track that goes from `minmax(0, 0fr)` to `minmax(0, 1fr)`, and
          therefore exactly one child to crop — hence the panel below rather than
          four siblings, which would open four implicit tracks and never
          collapse.

          The track itself is always rendered, and only what it holds comes and
          goes: the transition needs a stable element on both sides of the
          click, and this element costs one empty `<div>` where its contents
          cost a frieze, a log, two rankings and five counters — all of them
          reconciled on every window a sweep closes, for nobody. */}
      <div
        className="stats-body"
        id="stats-body"
        onTransitionEnd={(event) => {
          // The track's own transition, not one bubbling up from a child: the
          // panel holds several of its own, and any of them would otherwise
          // cut the close short.
          if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
            setClosing(false)
          }
        }}
      >
        {mounted && (
          <div className="stats-inner glass">
            <div className="stats-grid">
              <RankCard title={t('stats.topCreators')} ranking={creators} locale={locale} t={t} />
              <RankCard title={t('stats.topGames')} ranking={games} locale={locale} t={t} />
            </div>

            <div className="card glass">
              <div className="card-head">
                <h4>{t('progress.timeSplit')}</h4>
                <span className="sub">{t('stats.friezeSub', { n: reports.length })}</span>
              </div>
              <Frieze reports={reports} span={span} running={running} />
              {/* The legend is the caption of the frieze, not part of it: it is
                what the reader looks back at, so it stays outside the plot's
                pointer area. */}
              <div className="legend">
                <span>
                  <u className="done" />
                  {t('progress.legend.done')}
                </span>
                <span>
                  <u className="split" />
                  {t('progress.legend.split')}
                </span>
                <span>
                  <u className="lost" />
                  {t('progress.legend.lost')}
                </span>
              </div>
            </div>

            <div className="counters">
              {/* Amber, and it is not a fault: a clip nobody ever watched is the
                find this tool exists for, and the colour marks it as the thing
                to look at. */}
              <Counter
                tone="warn"
                label={t('stats.zeroViews')}
                value={formatCount(zeroViews, locale)}
              />
              <Counter
                label={t('progress.periods')}
                value={
                  progress
                    ? `${formatCount(progress.windowsDone, locale)}/${formatCount(progress.windowsTotal, locale)}`
                    : t('panel.nothingYet')
                }
              />
              <Counter
                label={t('progress.requests')}
                value={progress ? formatCount(progress.requests, locale) : t('panel.nothingYet')}
              />
              <Counter label={t('stats.windowsSplit')} value={formatCount(split, locale)} />
              <Counter
                label={t('panel.elapsed')}
                value={elapsedMs === null ? t('panel.nothingYet') : formatElapsed(elapsedMs)}
              />
            </div>

            <div className="card glass">
              <div className="card-head">
                <h4>{t('progress.log')}</h4>
                <span className="sub">{t('stats.logSub', { n: progress?.requests ?? 0 })}</span>
              </div>
              {/* Nothing here is animated: the log takes several lines a second,
                and a transition on a line's arrival makes flicker, not motion. */}
              <div className="log" ref={logRef}>
                {logEntries.length === 0 ? (
                  <p className="dim">{t('progress.logEmpty')}</p>
                ) : (
                  logEntries.map((entry) => (
                    <p key={entry.id} className={LOG_TONE[entry.kind]}>
                      {entry.text}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * What is behind the bar, said plainly — the reason to open it.
 *
 * Three shapes for three moments. Running, the slot carries the pending verdict:
 * a sweep under way wears the accent, not `--verdict`, which answers "is the
 * list whole?" and cannot answer it yet. Finished with windows lost, it carries
 * the broken one: that is the single strongest reason to open the drawer, and
 * the bar sits at the foot of the page where the alert at the top is long out of
 * sight. Otherwise, the figures.
 */
function Peek({
  running,
  progress,
  split,
  lost,
  t,
}: {
  running: boolean
  progress: Progress | null
  split: number
  lost: number
  t: T
}) {
  if (!progress) return null

  if (running) {
    return (
      <span className="verdict pending">
        <Icon name="rotate" />
        {t('panel.verdict.pending', { done: progress.windowsDone, total: progress.windowsTotal })}
      </span>
    )
  }

  if (lost > 0) {
    return (
      <span className="verdict broken">
        <Icon name="alert" />
        {t('panel.verdict.broken', { n: lost })}
      </span>
    )
  }

  // The split segment is dropped when there is none: "0 windows split" reads as
  // a fact worth reporting, and it is the absence of one.
  const parts = [
    t('stats.peekPeriods', { n: progress.windowsTotal }),
    t('stats.peekRequests', { n: progress.requests }),
  ]
  if (split > 0) parts.push(t('stats.peekSplit', { n: split }))

  return <span className="sb-peek">{parts.join(' · ')}</span>
}

/**
 * One ranking card. Creators and games take the same one on purpose: same bars,
 * same scale, so the eye compares them without relearning the chart.
 */
function RankCard({
  title,
  ranking,
  locale,
  t,
}: {
  title: string
  ranking: Ranking
  locale: Locale
  t: T
}) {
  const scale = barScale(ranking.rows)

  return (
    <div className="card glass">
      <div className="card-head">
        <h4>{title}</h4>
        <span className="sub">{t('stats.total', { n: ranking.total })}</span>
      </div>
      {ranking.rows.length === 0 ? (
        <p className="empty">{t('stats.rankingEmpty')}</p>
      ) : (
        <div className="bars">
          {ranking.rows.map((row) => (
            <div key={row.key}>
              <i>{row.label}</i>
              <s
                className={row.rest ? 'rest' : undefined}
                style={{ width: barWidth(row.count, scale) }}
              />
              <b>{formatCount(row.count, locale)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Label in silkscreen, figure in tabular monospace. Only window states take a colour. */
function Counter({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'bad' }) {
  return (
    <div className={tone ? `counter ${tone}` : 'counter'}>
      <i>{label}</i>
      <b>{value}</b>
    </div>
  )
}
