import { useEffect, useId, useState } from 'react'

import { activePreset, periodPresets, type PresetId } from '../domain/period'
import { escapeIsTaken } from '../hooks/useDismissable'
import { useLatest } from '../hooks/useLatest'
import type { ChannelLookup } from '../hooks/useChannelLookup'
import { useTranslation } from '../i18n/LocaleProvider'
import { AlertIcon, CloseIcon } from './Icon'
import type { MessageKey } from '../i18n/messages.fr'

/** One lookup rather than a key built by hand: a typo here fails `typecheck`. */
const PRESET_LABEL: Record<PresetId, MessageKey> = {
  month: 'panel.preset.month',
  year: 'panel.preset.year',
  all: 'panel.preset.all',
}

export interface SearchPanelProps {
  channel: string
  onChannelChange: (next: string) => void
  /** The channel of the last search of this session, or an empty string. */
  lastChannel: string
  /** Does the name typed outlive the tab? Off unless asked for. */
  remember: boolean
  onRememberChange: (next: boolean) => void
  since: string
  onSinceChange: (next: string) => void
  until: string
  onUntilChange: (next: string) => void
  /** Both bounds at one go, which is what a shortcut sets. */
  onPeriodChange: (period: { since: string; until: string }) => void
  /** `yyyy-mm-dd` in UTC: the end of the period cannot go beyond it. */
  today: string
  /** The disorder the bounds do not cover: a start later than the end. */
  periodError: string | null
  /** `yyyy-mm-dd`, or null while the channel is unknown. */
  channelCreatedAt: string | null
  /**
   * What is known about the name typed — see `useChannelLookup`. Only `missing`
   * refuses the search: it is the one that comes from Twitch answering that
   * there is no such channel, where `checking` and `unreachable` have disproved
   * nothing at all.
   */
  channelStatus: ChannelLookup['status']

  running: boolean
  onRun: () => void
  /**
   * The way back to the folded ticket, or nothing at all.
   *
   * Its presence **is** the switch: before the first search the ticket is the
   * whole screen, and both the corner button and the escape key would fold it
   * onto an empty stage — leaving a visitor with no way left to ask anything.
   */
  onFold?: () => void
}

/**
 * The ticket, open: one name to type, one period to pick, one button.
 *
 * It is the whole screen before a search, and nothing else is: a first visitor
 * has one thing to do, and four labelled fields of equal weight said nothing
 * about which. The channel takes the size of a title because it is the only
 * thing that has to be typed; the period is three shortcuts because that is how
 * it is chosen nineteen times out of twenty; and the two date fields — which
 * answer the twentieth — wait behind them.
 *
 * The DOM order is the reading order is the tab order. Only the columns are
 * placed, never a control: `grid-area` would let the eye and the keyboard
 * disagree. The way back out is the one exception, and it is placed out of the
 * flow rather than within it precisely so that the rule holds: it is first in
 * the markup, where the keyboard wants it, and in the corner, where the eye
 * looks for it, without taking a cell from the field the screen is about.
 */
export function SearchPanel({
  channel,
  onChannelChange,
  lastChannel,
  remember,
  onRememberChange,
  since,
  onSinceChange,
  until,
  onUntilChange,
  onPeriodChange,
  today,
  periodError,
  channelCreatedAt,
  channelStatus,
  running,
  onRun,
  onFold,
}: SearchPanelProps) {
  const { t } = useTranslation()
  const channelId = useId()
  const errorId = useId()
  const [datesOpen, setDatesOpen] = useState(false)
  /** Twitch has answered that the name names nothing. The only fault a field can be in here. */
  const unknown = channelStatus === 'missing'
  /**
   * The fields open by themselves on a fault, and cannot be shut while it
   * stands. A period can only go inconsistent by hand — but the bounds outlive
   * the tab, so a reload brings the fault back with the fields folded, and the
   * button that would fix it disabled with its cause out of sight.
   */
  const datesShown = datesOpen || periodError !== null

  /**
   * The search opens on a channel **confirmed to exist**, and on nothing else.
   *
   * Not "everything but the two cases that disprove it": a name half typed has
   * not been confirmed either, and a button that follows the keystrokes into
   * life and back out again — enabled on the "k", dead on the "ka", alive again
   * a second later — reads as a control with a mind of its own.
   *
   * `unreachable` therefore keeps it shut too, which is the honest answer as
   * well as the consistent one: a search needs the very endpoint the check
   * could not reach.
   *
   * The status is trusted rather than second-guessed against the field beside
   * it — `blank` is what an empty field resolves to, and two readers of one fact
   * are one too many.
   *
   * None of it applies while a search runs: this same button is then the way out
   * of it, and clearing the field must not strand a reader inside a search they
   * can no longer stop.
   */
  const refused = !running && (periodError !== null || channelStatus !== 'found')

  /**
   * The escape key, for as long as there is somewhere to escape to.
   *
   * Kin to `useDismissable`, and deliberately only half of it: this panel is a
   * section of the page rather than a popover, so a click landing outside it is
   * a click on the results — not a dismissal.
   *
   * The key belongs to the innermost thing open, and this panel is the
   * outermost: the toolbar's chips and the player stay mounted over it, and a
   * reader closing one of those asked for one thing to close, not two. It
   * cannot be settled by letting the other listener go first — they all sit on
   * `document` in the bubble phase, and this one, registered when the panel
   * mounted, would run before a chip that opened a minute later. So it asks
   * instead: see `escapeIsTaken`.
   *
   * The callback is read through a ref, since the one App passes is rebuilt on
   * every render and would tear the listener down with it.
   */
  const foldRef = useLatest(onFold)
  const foldable = onFold !== undefined
  useEffect(() => {
    if (!foldable) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (escapeIsTaken()) return

      foldRef.current?.()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [foldable, foldRef])

  const presets = periodPresets({ today, channelCreatedAt })
  const active = activePreset(presets, since, until)

  return (
    <div className="search-stage">
      <section className="ticket-open" aria-label={t('panel.target')}>
        {/* First in the DOM as it is first in the corner, like the player's:
            the way out is the one control that has to be reachable without
            reading anything first. It says where it leads rather than wearing a
            bare cross — a cross names no destination, and this one does not
            undo what has just been typed either. */}
        {onFold && (
          <button
            type="button"
            className="ticket-fold"
            aria-label={t('panel.fold')}
            onClick={onFold}
          >
            <CloseIcon size={13} />
          </button>
        )}

        {/* Not a wrapping `<label>`: the prefix sits inside the box beside the
            field, and a label that contained it would read out "Channel
            twitch.tv/" as the field's name. */}
        <div className="ticket-channel">
          <label className="field-label" htmlFor={channelId}>
            {t('panel.channel')}
          </label>
          {/* The address the name completes, which is also what says which of a
              streamer's several names is being asked for: the one in the URL.

              The box turns to the danger edge when the name names nothing: the
              field is the thing at fault, and a red line under an untouched
              field reads as a remark about something else. */}
          <div className={`channel-input${unknown ? ' is-unknown' : ''}`}>
            <span className="channel-prefix">twitch.tv/</span>
            <input
              id={channelId}
              value={channel}
              onChange={(event) => onChannelChange(event.target.value)}
              placeholder={t('panel.channelPlaceholder')}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              /* The colour says it to whoever sees it; these say it to whoever
                 does not, and tie the reason to the field rather than leaving
                 it a stray sentence somewhere underneath. */
              aria-invalid={unknown || undefined}
              aria-describedby={unknown ? errorId : undefined}
            />
          </div>

          {/* The cause of a disabled button, under the field that carries it —
              the same treatment the period fault gets, and for the same reason:
              a control that refuses without saying why is a control nobody can
              get past. Rendered empty the rest of the time, its height reserved
              in CSS, so the message shifts nothing when it lands and a screen
              reader finds the live region already there. */}
          <p className="field-error" role="alert" id={errorId}>
            {unknown && (
              <>
                <AlertIcon />
                <span>{t('panel.channelUnknown')}</span>
              </>
            )}
          </p>
        </div>

        <div className="ticket-presets" role="group" aria-label={t('panel.period')}>
          <span className="field-label">{t('panel.period')}</span>
          <div className="presets">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`chip${active === preset.id ? ' is-on' : ''}`}
                aria-pressed={active === preset.id}
                onClick={() => onPeriodChange({ since: preset.since, until: preset.until })}
              >
                {t(PRESET_LABEL[preset.id])}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={`ticket-run ${running ? '' : 'primary'}`}
          onClick={onRun}
          disabled={refused}
        >
          {running ? t('panel.stop') : t('panel.run')}
        </button>

        {/* The footnotes of the query: what becomes of the name typed, and what
            period the shortcut above actually resolved to. Neither is a step of
            the task, and neither takes a place in front of the button. */}
        <div className="ticket-foot">
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => onRememberChange(event.target.checked)}
            />
            {t('panel.remember')}
          </label>

          <p className="ticket-dates">
            <span>{t('panel.dateRange', { from: { day: since }, to: { day: until } })}</span>
            <button
              type="button"
              className="link"
              aria-expanded={datesShown}
              onClick={() => setDatesOpen(!datesShown)}
            >
              {t('panel.editDates')}
            </button>
          </p>
        </div>

        {datesShown && (
          <div className="ticket-fields">
            <label>
              <span>{t('panel.since')}</span>
              {/* The picker greys out what precedes the channel's creation; the
                  value itself is already clamped upstream — `min` alone does not
                  prevent typing. */}
              <input
                type="date"
                min={channelCreatedAt ?? undefined}
                value={since}
                onChange={(event) => onSinceChange(event.target.value)}
              />
            </label>
            <label>
              <span>{t('panel.until')}</span>
              {/* Every bound set here is backed by a `clamp` on the App side: a
                  bound alone marks the field invalid without preventing anything. */}
              <input
                type="date"
                max={today}
                value={until}
                onChange={(event) => onUntilChange(event.target.value)}
              />
            </label>

            {/* Under the two fields it speaks about, not in the log alone —
                which is folded by default. The search button is disabled at the
                same time: a click with no visible effect is what made the error
                impossible to find.

                Rendered empty the rest of the time, its height reserved in CSS,
                so the message shifts nothing when it arrives. It lives inside
                the disclosure because a fault forces the disclosure open: the
                region is therefore always already there when the message lands,
                which is what makes a screen reader announce it — a
                `role="alert"` inserted at the moment of the error often goes
                unnoticed. */}
            <p className="field-error" role="alert">
              {periodError && (
                <>
                  <AlertIcon />
                  <span>{periodError}</span>
                </>
              )}
            </p>
          </div>
        )}
      </section>

      {/* The channel of the last search of this session. Its whole job is the
          second search: the field holds what is being typed now, one click
          brings back what was searched a minute ago. Nothing is offered while
          the field already holds it — that would be offering nothing. */}
      <p className="ticket-recent">
        {lastChannel && lastChannel !== channel && (
          <>
            {t('panel.lastChannel')}
            <button type="button" className="chip" onClick={() => onChannelChange(lastChannel)}>
              {lastChannel}
            </button>
          </>
        )}
      </p>

      {/* No block of three cards answering what a first search costs. The
          search says all three of those things itself, and says them when they
          are true rather than in advance: the count climbing is "the clips
          arrive as they are found", the estimate is "about a minute per year of
          channel", and "Stop the search" is on the ticket the whole time. */}
    </div>
  )
}
