import { formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import { AlertIcon, LogoutIcon } from './Icon'

export interface SearchPanelProps {
  authMessage: string
  authKind: 'ok' | 'bad' | ''
  /** Connected, or presumed so on the strength of a stored token. */
  connected: boolean
  canConnect: boolean
  onConnect: () => void
  onDisconnect: () => void

  channel: string
  onChannelChange: (next: string) => void
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
}

/** Everything the search needs: who you are, and what to look for. */
export function SearchPanel({
  authMessage,
  authKind,
  connected,
  canConnect,
  onConnect,
  onDisconnect,
  channel,
  onChannelChange,
  since,
  onSinceChange,
  until,
  onUntilChange,
  today,
  periodError,
  channelCreatedAt,
  running,
  onRun,
}: SearchPanelProps) {
  const { locale, t } = useTranslation()

  return (
    <aside className="rail">
      <div className="rail-inner">
        <p className="section-label">{t('panel.access')}</p>
        <div className={`status ${authKind}`}>{authMessage}</div>
        {/* Emphasis follows what is left to do. Once connected, the state is
          already stated — with the remaining life — by the line above: keeping a
          disabled "Connected to Twitch" would not be a control, just an inert
          restatement. One action is left, and it is leaving. */}
        {connected ? (
          <button type="button" className="disconnect wide" onClick={onDisconnect}>
            <LogoutIcon />
            {t('panel.disconnect')}
          </button>
        ) : (
          <button type="button" className="primary wide" onClick={onConnect} disabled={!canConnect}>
            {t('panel.connect')}
          </button>
        )}

        <p className="section-label">{t('panel.target')}</p>
        <label>
          <span>{t('panel.channel')}</span>
          <input
            value={channel}
            onChange={(event) => onChannelChange(event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="duo">
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
        </div>

        {/* Announced under the offending fields, not in the log alone — which is
          folded by default. The sweep button is disabled at the same time: a
          click with no visible effect is what made the error impossible to
          find.

          Always rendered, its height reserved in CSS: the message appearing
          must shift neither the sweep button nor the rest of the panel. The
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

        {/* Offered only when it genuinely widens the period asked for. Its place
          is held the rest of the time: it appears and disappears with whatever
          channel is typed, otherwise it would push the sweep button on every
          keystroke.

          "of the channel" is implied by the field just above and by the "Target"
          label: the long wording left only 9px of margin in the rail, and would
          have wrapped onto two lines on a wider interface font — the reserved
          height would have been exceeded. */}
        <p className="channel-hint">
          {channelCreatedAt && channelCreatedAt < since && (
            <button type="button" className="link" onClick={() => onSinceChange(channelCreatedAt)}>
              {t('panel.backToCreation', { date: formatDay(channelCreatedAt, locale) })}
            </button>
          )}
        </p>

        <button
          type="button"
          className={connected && !running ? 'primary wide' : 'wide'}
          onClick={onRun}
          disabled={periodError !== null}
        >
          {running ? t('panel.stop') : t('panel.run')}
        </button>
      </div>
    </aside>
  )
}
