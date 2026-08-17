import { formatCount, formatDay, formatElapsed } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import { Icon, type IconName } from './Icon'

/**
 * What the sweep can say about its own completeness — the one thing it exists
 * to promise, and the only readout that has a hue of its own.
 *
 * `idle` is not a result but the absence of one: it still draws every row, so
 * that starting a sweep shifts nothing under the eye.
 */
export interface SweepVerdict {
  kind: 'idle' | 'pending' | 'complete' | 'broken'
  /** Windows already swept, and how many there are. Both, or neither. */
  done?: number
  total?: number
  /** Windows saturated down to the floor: their clips are missing for good. */
  lost?: number
}

export interface SearchPanelProps {
  /**
   * The rail has no column to live in under 1080px, so its two blocks are
   * rendered flat instead. Driven by a media query on the caller's side rather
   * than by a `@media` here: rendering both subtrees would put two channel
   * inputs in the document, each answering to the same label.
   */
  compact: boolean

  channel: string
  onChannelChange: (next: string) => void
  /** Does the name typed outlive the tab? Off unless asked for. */
  remember: boolean
  onRememberChange: (next: boolean) => void
  since: string
  onSinceChange: (next: string) => void
  until: string
  onUntilChange: (next: string) => void
  /** `yyyy-mm-dd` in UTC: the end of the period cannot go beyond it. */
  today: string
  /** The disorder the bounds do not cover: a start later than the end. */
  periodError: string | null
  /** `yyyy-mm-dd`, or null while the channel is unknown. */
  channelCreatedAt: string | null

  running: boolean
  onRun: () => void

  /** What the sweep brought back. Read, never written: the footer states. */
  clipsFound: number
  totalViews: number
  /** The extent actually explored, `yyyy-mm-dd` — not the extent asked for. */
  coveredFrom: string | null
  coveredTo: string | null
  elapsedMs: number | null
  verdict: SweepVerdict
}

/**
 * Twitch opened in June 2011, so no clip can predate it.
 *
 * The floor serves "All time" alone, and only while the channel's creation date
 * is still unknown — a start set earlier than the channel existed costs one
 * yearly window, so at least one request, per year too many, and returns
 * nothing for it.
 */
const TWITCH_DAWN = '2011-06-06'

/**
 * A `yyyy-mm-dd` day shifted by a whole number of days, in UTC like every other
 * bound here: shifting in local time moves the result by one day west of
 * Greenwich, twice a year for everyone else.
 */
function shiftDays(day: string, count: number): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, dayOfMonth - count)).toISOString().slice(0, 10)
}

/**
 * The same, by whole months, with the rule `monthBefore` already follows in the
 * domain: the day of month is pulled back to the last day the target month has,
 * because 31 August minus six months has no 31st to land on and would otherwise
 * slide forward into March.
 */
function shiftMonths(day: string, count: number): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  // Day 0 of the month after the target one, that is the target's last day —
  // leap years included. An out-of-range month index rolls the year back on its
  // own, which is what carries December to June.
  const lastDay = new Date(Date.UTC(year, month - count, 0)).getUTCDate()

  return new Date(Date.UTC(year, month - 1 - count, Math.min(dayOfMonth, lastDay)))
    .toISOString()
    .slice(0, 10)
}

/**
 * The four presets, each one nothing but the start date it writes — the end is
 * always today, since a period that stops short of now is a period someone
 * typed, not one anybody would pick from a chip.
 *
 * A preset spends no request and locks nothing: it fills the two fields, which
 * stay editable straight after. It is a shortcut for typing, never a mode.
 *
 * Three of the four read only today; the fourth reads only the floor. They are
 * declared with just the arguments they use rather than padded to a common
 * shape — a function of one argument satisfies a call site that offers two, so
 * the uniform signature would have bought nothing and cost three unused names.
 */
const PRESETS = [
  { key: 'panel.preset.30d', from: (today: string) => shiftDays(today, 30) },
  { key: 'panel.preset.6m', from: (today: string) => shiftMonths(today, 6) },
  { key: 'panel.preset.1y', from: (today: string) => shiftMonths(today, 12) },
  { key: 'panel.preset.all', from: (_today: string, floor: string) => floor },
] as const

/** One glyph per verdict, so the three states are told apart without the hue. */
const VERDICT_GLYPH: Record<SweepVerdict['kind'], IconName> = {
  idle: 'radar',
  pending: 'rotate',
  complete: 'check',
  broken: 'alert',
}

/**
 * The whole left column: what to sweep at the top, what the last sweep brought
 * back at the bottom, and nothing above the table any more.
 *
 * Access is no longer here — the top bar carries it. The rail had grown into
 * the panel where everything happened to live; it is the sweep's panel now, and
 * that is what buys the table its eleven visible rows.
 */
export function SearchPanel({
  compact,
  channel,
  onChannelChange,
  remember,
  onRememberChange,
  since,
  onSinceChange,
  until,
  onUntilChange,
  today,
  periodError,
  channelCreatedAt,
  running,
  onRun,
  clipsFound,
  totalViews,
  coveredFrom,
  coveredTo,
  elapsedMs,
  verdict,
}: SearchPanelProps) {
  const { locale, t } = useTranslation()

  /* A click with no visible effect is what made the error impossible to find,
     so the sweep is refused while the period contradicts itself. Refused with
     `aria-disabled` and not `disabled`: the design system asks for it by name —
     a `disabled` element leaves the tab order and stops carrying a tooltip, so
     the control can no longer say *why* it is unavailable. Which means the
     handler has to check for itself; the attribute prevents nothing. */
  const blocked = periodError !== null
  const run = () => {
    if (!blocked) onRun()
  }

  const presets = PRESETS.map((preset) => {
    const from = preset.from(today, channelCreatedAt ?? TWITCH_DAWN)

    /* Pressed is read off the two fields, never remembered from a click: typing
       over either date releases the chip on its own, and a period reached by
       hand that happens to be the last thirty days lights the chip that would
       have written it. The state is what the fields say, not what was done. */
    return { key: preset.key, pressed: from === since && until === today, from }
  })

  const channelField = (
    <label className="field">
      {/* The visible "Channel" above is a `.flabel`, a plain span the markup
        contract keeps unassociated — so the field carries its own name here.
        The same fragment serves the narrow tiers, where no `.flabel` is drawn
        at all: one name, whichever of the two shapes is rendered. */}
      <span className="visually-hidden">{t('panel.channel')}</span>
      <span className="at">@</span>
      <input
        value={channel}
        onChange={(event) => onChannelChange(event.target.value)}
        spellCheck={false}
      />
    </label>
  )

  /* No drawn calendar glyph beside the input, unlike the design's static
     specimen: a native date field brings its own picker indicator, and that one
     is the half a click actually opens. Two calendars in a 130px field cost the
     value its last two digits — measured, the year came out truncated.
     `controls.css` puts the user agent's indicator back under the cascade, so
     the mark that survives is the set's. */
  const dates = (
    <div className="dates">
      <label className="date">
        {/* Only "Period" is drawn, over the pair: each field still needs a name
          of its own, or the two would be indistinguishable to anyone not
          looking at them. */}
        <span className="visually-hidden">{t('panel.since')}</span>
        {/* The picker greys out what precedes the channel's creation; the value
          itself is already clamped upstream — `min` alone does not prevent
          typing. */}
        <input
          type="date"
          min={channelCreatedAt ?? undefined}
          value={since}
          onChange={(event) => onSinceChange(event.target.value)}
        />
      </label>
      <label className="date">
        <span className="visually-hidden">{t('panel.until')}</span>
        {/* Every bound set here is backed by a `clamp` on the App side: a bound
          alone marks the field invalid without preventing anything. */}
        <input
          type="date"
          max={today}
          value={until}
          onChange={(event) => onUntilChange(event.target.value)}
        />
      </label>
    </div>
  )

  const chips = (
    <div className="chips" role="group" aria-label={t('panel.presets')}>
      {presets.map((preset) => (
        <button
          key={preset.key}
          type="button"
          className="chip"
          aria-pressed={preset.pressed ? 'true' : 'false'}
          onClick={() => {
            onSinceChange(preset.from)
            onUntilChange(today)
          }}
        >
          {t(preset.key)}
        </button>
      ))}
    </div>
  )

  /* Always rendered and its height reserved in CSS: the message appears with
     whatever period is typed, and must push neither the sweep button nor the
     tally below it.

     The permanent live region is also what makes screen readers announce the
     error — a `role="alert"` inserted at the moment of the fault often goes
     unnoticed.

     It used to be joined by a link back to the channel's creation date. The
     "All time" preset writes that same date, so the link was a second control
     for one action — and it cost a reserved line in a column that had none to
     spare. */
  const periodNotice = (
    <p className="field-err" role="alert">
      {periodError && (
        <>
          <Icon name="alert" />
          <span>{periodError}</span>
        </>
      )}
    </p>
  )

  /* A sweep that has not started has no figures to state, and states so — the
     rows are drawn all the same. `0` would be a claim; the dash is the absence
     of one. Each value falls back on its own account: the extent is unknown
     until the first window closes, the stopwatch until the first tick. */
  const swept = verdict.kind !== 'idle'
  const nothing = t('panel.nothingYet')
  const clips = swept ? formatCount(clipsFound, locale) : nothing
  const views = swept ? formatCount(totalViews, locale) : nothing
  const covered =
    coveredFrom && coveredTo
      ? t('sweep.window', {
          from: formatDay(coveredFrom, locale),
          to: formatDay(coveredTo, locale),
        })
      : nothing
  const elapsed = elapsedMs === null ? nothing : formatElapsed(elapsedMs)

  const verdictText =
    verdict.kind === 'pending'
      ? t('panel.verdict.pending', { done: verdict.done ?? 0, total: verdict.total ?? 0 })
      : verdict.kind === 'broken'
        ? t('panel.verdict.broken', { n: verdict.lost ?? 0 })
        : verdict.kind === 'complete'
          ? t('panel.verdict.complete')
          : t('panel.verdict.idle')

  /* Three skins for four states: a sweep in flight takes the accent, since it
     cannot yet answer "is the list whole?", a loss takes the red, and both the
     complete verdict and the idle one take the readout's own cyan — the second
     saying only that there is nothing to report yet. */
  const verdictVariant =
    verdict.kind === 'pending' ? ' pending' : verdict.kind === 'broken' ? ' broken' : ''

  const sweepLabel = running ? t('panel.stop') : t('panel.run')

  if (compact) {
    return (
      <>
        <div className="mobile-search">
          {channelField}
          {/* The rail's call to action reduced to its glyph — its label would
            take the width the field needs. The name follows it. */}
          <button
            type="button"
            className="go"
            onClick={run}
            aria-disabled={blocked ? 'true' : 'false'}
            aria-label={sweepLabel}
          >
            <Icon name={running ? 'stop' : 'radar'} />
          </button>
        </div>
        {/* The period does not leave with the column: without the dates and
          their presets, a narrow window could only ever sweep the last month
          the field was left on. */}
        <div className="mobile-period">
          {dates}
          {chips}
          {periodNotice}
        </div>
        <div className="msum">
          {/* Whole sentences, not the rail's two-column labels glued to their
            figures: "12 480 Clips trouvés" reads as a stack laid on its side.
            These two keys already say the same thing as a phrase, and they
            agree with their own number, which a label never could. */}
          <span>{t('results.count.found', { n: clipsFound })}</span>
          <span>{t('results.views', { n: totalViews })}</span>
          {/* The four rows of the rail's footer will not fit on one line; the
            two figures the sweep is judged on do, and the verdict closes it. */}
          <span className={`ok${verdictVariant}`}>
            <Icon name={VERDICT_GLYPH[verdict.kind]} />
            {verdictText}
          </span>
        </div>
      </>
    )
  }

  return (
    <aside className="rail glass">
      <div className="rail-top">
        <p className="lbl">{t('panel.sweep')}</p>
        <div className="fieldset">
          <span className="flabel">{t('panel.channel')}</span>
          {channelField}
        </div>
        {/* A footnote to the field above, not a control in its own right: it
          says what becomes of the name typed there, and nothing else. The
          caption repeats the switch's name rather than labelling it — the piece
          is drawn as an empty track, so the name has to ride on the control
          itself for anyone who never sees the caption. */}
        <div className="switch-row">
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={remember ? 'true' : 'false'}
            aria-label={t('panel.remember')}
            onClick={() => onRememberChange(!remember)}
          />
          <span>{t('panel.remember')}</span>
        </div>
        <div className="fieldset">
          <span className="flabel">{t('panel.period')}</span>
          {dates}
          {chips}
        </div>
        {periodNotice}
        <button
          type="button"
          className={running ? 'cta wide stop' : 'cta wide'}
          onClick={run}
          aria-disabled={blocked ? 'true' : 'false'}
        >
          <Icon name={running ? 'stop' : 'radar'} />
          {sweepLabel}
        </button>
      </div>

      {/* The tally sits at the foot of the rail, not above the table: it is a
        readout, and a readout that pushes the results down costs eleven rows
        for four figures. The heading is the only thing that changes while the
        sweep runs — the rows are the same rows, filling in. */}
      <div className="rail-bottom">
        <p className="lbl">{running ? t('panel.thisSweep') : t('panel.lastSweep')}</p>
        <div className="stat-row">
          <i>{t('panel.clipsFound')}</i>
          <b>{clips}</b>
        </div>
        <div className="stat-row">
          <i>{t('panel.totalViews')}</i>
          <b>{views}</b>
        </div>
        <div className="stat-row">
          <i>{t('panel.periodCovered')}</i>
          <b>{covered}</b>
        </div>
        <div className="stat-row">
          <i>{t('panel.elapsed')}</i>
          <b>{elapsed}</b>
        </div>
        <div className={`verdict${verdictVariant}`}>
          <Icon name={VERDICT_GLYPH[verdict.kind]} />
          {verdictText}
        </div>
      </div>
    </aside>
  )
}
