import { useTranslation } from '../i18n/LocaleProvider'
import { LogoutIcon } from './Icon'
import type { AccessKind } from '../domain/access'

export interface AccountProps {
  /** Where the access stands, already worded and already translated. */
  message: string
  kind: AccessKind
  /** Connected, or presumed so on the strength of a stored token. */
  connected: boolean
  canConnect: boolean
  onConnect: () => void
  onDisconnect: () => void
}

/**
 * Who you are, on the nameplate.
 *
 * It used to open the ticket, where it took the first of four columns for the
 * whole session. But the access is not a parameter of the search: it does not
 * change from one search to the next, it is not read again once granted, and it
 * survives the ticket folding. It belongs with the language and the theme —
 * what holds for the session, filed at the top of the page.
 */
export function Account({
  message,
  kind,
  connected,
  canConnect,
  onConnect,
  onDisconnect,
}: AccountProps) {
  const { t } = useTranslation()

  return (
    <div className="account" role="group" aria-label={t('panel.access')}>
      <div className={`status ${kind}`}>{message}</div>
      {/* Emphasis follows what is left to do. Once connected, the state is
          already stated by the line beside it: keeping a disabled "Connected to
          Twitch" would not be a control, just an inert restatement. One action
          is left, and it is leaving. */}
      {connected ? (
        <button type="button" className="disconnect" onClick={onDisconnect}>
          <LogoutIcon />
          {t('panel.disconnect')}
        </button>
      ) : (
        <button type="button" className="primary" onClick={onConnect} disabled={!canConnect}>
          {t('panel.connect')}
        </button>
      )}
    </div>
  )
}
