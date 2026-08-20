import { formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import { AlertIcon, SearchIcon } from './Icon'

export interface SearchPanelProps {
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
  /** Whether starting is even on the table: without a session, nothing runs. */
  connected: boolean
  /** False without a build-time client id: there is no application to connect to. */
  canConnect: boolean
  onConnect: () => void

  running: boolean
  onRun: () => void
}

/**
 * What to look for: one channel, one period. Centred at the top of the page and
 * nothing else beside it, which is the whole bet of the model — the page opens
 * on a single thing to do, and the clips take the full width underneath.
 *
 * The period stays two dated fields rather than folding into a chip: a chip
 * needs a panel behind it, and a panel that has to hold two bounds, their
 * clamps and the jump back to the channel's creation is a screen of its own.
 * Two fields say the same thing today without inventing it.
 */
export function SearchPanel({
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
  connected,
  canConnect,
  onConnect,
  running,
  onRun,
}: SearchPanelProps) {
  const { locale, t } = useTranslation()

  return (
    <section className="search">
      {/* Only while disconnected, and it is the whole of the unconnected screen:
          a visitor who has never heard of this tool is being asked to hand over
          a Twitch session, and "Connect to Twitch" alone does not say what that
          buys or what it costs. The tokens carry no scope at all, which is the
          one fact worth stating before the click — afterwards it is noise. */}
      {!connected && <p className="search-why">{t('access.why')}</p>}

      {/* The name and the act, on one line: the field is the page's subject and
          gets the size to say so. */}
      <div className="search-row">
        <SearchIcon />
        <span className="search-at" aria-hidden="true">
          @
        </span>
        <input
          className="search-channel"
          value={channel}
          onChange={(event) => onChannelChange(event.target.value)}
          spellCheck={false}
          aria-label={t('panel.channel')}
        />
        {/* One button, and it is whatever there is to do next. While there is no
            session, starting cannot work: offering it here and hiding the only
            thing that can in a corner of the top bar left a first visitor
            clicking the biggest control on the page for nothing. */}
        {connected ? (
          <button
            type="button"
            className={running ? '' : 'primary'}
            onClick={onRun}
            disabled={periodError !== null}
          >
            {running ? t('panel.stop') : t('panel.run')}
          </button>
        ) : (
          <button type="button" className="primary" onClick={onConnect} disabled={!canConnect}>
            {t('panel.connect')}
          </button>
        )}
      </div>

      <div className="search-period">
        {/* The lower bound and its footnote, in one column: the link sets this
            field and no other, and trailing the whole row it read as a remark
            about the period rather than about where it starts. */}
        <div className="search-bound">
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
          {/* Offered only when it genuinely widens the period asked for, and its
              place held the rest of the time: it appears and disappears with
              whatever channel is typed, and would otherwise shift the row on
              every keystroke.

              A session is part of that condition. The date outlives one — it is
              a fact about the channel, cached and still true — but the offer
              built on it does not: widening a period is something only a session
              can go and do. */}
          <span className="channel-hint">
            {connected && channelCreatedAt && channelCreatedAt < since && (
              <button
                type="button"
                className="link"
                onClick={() => onSinceChange(channelCreatedAt)}
              >
                {t('panel.backToCreation', { date: formatDay(channelCreatedAt, locale) })}
              </button>
            )}
          </span>
        </div>
        <label>
          <span>{t('panel.until')}</span>
          {/* Every bound set here is backed by a `clamp` on the App side: a
              bound alone marks the field invalid without preventing anything. */}
          <input
            type="date"
            max={today}
            onChange={(event) => onUntilChange(event.target.value)}
            value={until}
          />
        </label>
        {/* A footnote to the channel field, not a control in its own right: it
            says what becomes of the name typed there, and nothing else. */}
        <label className="remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => onRememberChange(event.target.checked)}
          />
          {t('panel.remember')}
        </label>
      </div>

      {/* Announced under the offending fields, not in the log alone — which is
          folded by default. The start button is disabled at the same time: a
          click with no visible effect is what made the error impossible to
          find.

          Always rendered, its height reserved in CSS: the message appearing
          must shift neither the readout below nor the rest of the block. The
          persistent live region is also what makes screen readers announce the
          message — a `role="alert"` inserted at the moment of the error often
          goes unnoticed. */}
      <p className="field-error" role="alert">
        {periodError && (
          <>
            <AlertIcon />
            <span>{periodError}</span>
          </>
        )}
      </p>
    </section>
  )
}
