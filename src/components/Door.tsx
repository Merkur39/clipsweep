import { formatDuration } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import { TwitchIcon } from './Icon'
import type { AccessKind } from '../domain/access'

/**
 * Four clips that do not exist, to show the shape of what does.
 *
 * Made up on purpose and stated as such: nothing is searched before a
 * connection, so there is nothing real to show, and an empty grid would
 * illustrate nothing. The block is `aria-hidden` for that reason — a screen
 * reader has the pitch beside it, and must not be read four fabricated titles
 * as though they were results.
 *
 * The titles stay in French in both catalogues: a clip's title is content, not
 * interface, and the real ones are never translated either.
 */
const PEEK = [
  {
    art: 'peek-1',
    title: 'il one-shot le boss après 4 h d’essais',
    creator: 'lulubz',
    views: 12_480,
    duration: 38,
  },
  {
    art: 'peek-2',
    title: 'on refait tout depuis le début',
    creator: 'anonyme',
    views: 6,
    duration: 19,
  },
  {
    art: 'peek-3',
    title: 'quand le chat a raison depuis le début',
    creator: 'clipmaker42',
    views: 4117,
    duration: 51,
  },
  {
    art: 'peek-4',
    title: 'ok là je comprends plus rien',
    creator: 'Miya_',
    views: 47,
    duration: 71,
  },
]

export interface DoorProps {
  /** Where the access stands, already worded and already translated. */
  message: string
  kind: AccessKind
  canConnect: boolean
  onConnect: () => void
}

/**
 * The wall, and the case for it.
 *
 * It is the whole screen for whoever arrives without a session, and that is not
 * a design preference: every search spends a Twitch quota, and a quota is what
 * an account is. There is nothing to demonstrate first, so the screen has to be
 * worth reading rather than worth clicking through — what the tool does, why the
 * connection is what buys it, and what the connection does not ask for.
 *
 * It steps aside the moment a search has run: a session that expires with clips
 * on screen must not take them away, and the access has an account block on the
 * nameplate to say so from there.
 */
export function Door({ message, kind, canConnect, onConnect }: DoorProps) {
  const { t } = useTranslation()

  return (
    <div className="door">
      <div className="door-pitch">
        <h2 className="door-title">
          {t('door.title')} <em>{t('door.titleEm')}</em>
        </h2>

        <p className="door-lede">{t('door.lede')}</p>

        {/* A neutral rule, not an accent one: the system keeps the accent for
            what is active or picked, and an aside that took it would dilute the
            one signal that says "this is on". */}
        <p className="door-why">
          <b>{t('door.whyTitle')}</b> {t('door.why')}
        </p>

        {/* Only what is worth reading here. "Disconnected" is what the whole
            screen already says; a refusal, or an application with no client id,
            is the reason the button below will not do what it promises. */}
        {kind === 'bad' && <div className={`status ${kind}`}>{message}</div>}

        <button
          type="button"
          className="primary door-connect"
          onClick={onConnect}
          disabled={!canConnect}
        >
          <TwitchIcon />
          {t('panel.connect')}
        </button>

        {/* Said in the words of what is not being asked for: the OAuth screen
            that follows names scopes, and a reader who has just read this can
            check it against what Twitch then shows them. */}
        <ul className="door-guarantees">
          <li>{t('door.guarantee.permissions')}</li>
          <li>{t('door.guarantee.privacy')}</li>
        </ul>
      </div>

      {/* What waits behind, drawn as the readout will draw it: the same tile,
          the same three lines under it. The clips are made up — see `PEEK` —
          and the block is hidden from assistive technology, which has the pitch
          beside it and no business being read four titles that do not exist. */}
      <div className="door-peek" aria-hidden="true">
        <div className="door-peek-grid">
          {PEEK.map((clip) => (
            <div className="tile" key={clip.art}>
              <span className="tile-open">
                <span className={`tile-frame ${clip.art}`}>
                  <span className="tile-duration">{formatDuration(clip.duration)}</span>
                </span>
                <span className="tile-title">{clip.title}</span>
                <span className="tile-meta">
                  <span className="tile-views">{t('results.views', { n: clip.views })}</span>
                  {` · ${clip.creator}`}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* No inert ticket under the pitch. It drew the shape of the tool at half
          opacity, with a channel field naming no channel and a button that
          refused to be pressed — which reads as a form that has failed to load
          rather than as an illustration of what comes next. The glimpse beside
          the argument already shows what waits behind, and it shows clips. */}
    </div>
  )
}
