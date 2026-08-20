import { useTranslation } from '../i18n/LocaleProvider'
import { LogoutIcon } from './Icon'

export interface AccessProps {
  message: string
  kind: 'ok' | 'bad' | ''
  /** Connected, or presumed so on the strength of a stored token. */
  connected: boolean
  onDisconnect: () => void
}

/**
 * Who you are, filed in the top bar beside the language and the theme.
 *
 * It sits there rather than above the search because it is not a step: a
 * visitor connects once and then never thinks about it again, while the
 * channel and the period are retyped every time. Putting the two together made
 * signing in look like the first field of a form.
 *
 * It carries the state and the way out, never the way in. Connecting is the
 * one thing a visitor without a session has to do, and it belongs in the search
 * block where they are already looking — not in a corner, competing with a
 * bigger button that cannot work yet.
 */
export function Access({ message, kind, connected, onDisconnect }: AccessProps) {
  const { t } = useTranslation()

  return (
    <div className="access">
      <span className={`status ${kind}`}>{message}</span>
      {/* Leaving is named, not left to its glyph: an arrow out of a panel is
          only obvious to whoever already knows what it does, and this one ends
          a session. */}
      {connected && (
        <button
          type="button"
          className="disconnect"
          aria-label={t('panel.disconnect')}
          onClick={onDisconnect}
        >
          <LogoutIcon />
          {/* Named on the button itself, not left to this span: a phone hides
              the words to keep the top bar on one line, and an accessible name
              that disappears with them would leave a bare arrow. */}
          <span className="disconnect-label">{t('panel.disconnect')}</span>
        </button>
      )}
    </div>
  )
}
