import { LogoutIcon } from './Icon'

export interface SearchPanelProps {
  authMessage: string
  authKind: 'ok' | 'bad' | ''
  /** Connecté, ou présumé tel sur la foi d'un jeton stocké. */
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
  /** `yyyy-mm-dd` en UTC : la fin de période ne peut pas aller au-delà. */
  today: string
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
  channelCreatedAt,
  running,
  onRun,
}: SearchPanelProps) {
  return (
    <aside className="rail">
      <div className="rail-inner">
        <p className="section-label">Accès</p>
        <div className={`status ${authKind}`}>{authMessage}</div>
        {/* L'emphase suit ce qu'il reste à faire. Une fois connecté, l'état est
          déjà dit — avec la durée restante — par la ligne au-dessus : garder un
          « Connecté à Twitch » désactivé ne serait pas un contrôle, juste une
          redite inerte. Il ne reste qu'une action, et c'est de partir. */}
        {connected ? (
          <button type="button" className="disconnect wide" onClick={onDisconnect}>
            <LogoutIcon />
            Se déconnecter
          </button>
        ) : (
          <button type="button" className="primary wide" onClick={onConnect} disabled={!canConnect}>
            Se connecter à Twitch
          </button>
        )}

        <p className="section-label">Cible</p>
        <label>
          <span>Chaîne</span>
          <input
            value={channel}
            onChange={(event) => onChannelChange(event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="duo">
          <label>
            <span>Depuis</span>
            {/* Le sélecteur grise ce qui précède la création de la chaîne ; la
              valeur, elle, est déjà bornée en amont — `min` seul n'empêche pas
              une saisie au clavier. */}
            <input
              type="date"
              min={channelCreatedAt ?? undefined}
              value={since}
              onChange={(event) => onSinceChange(event.target.value)}
            />
          </label>
          <label>
            <span>Jusqu'au</span>
            {/* Chaque borne posée ici est adossée à un `clamp` côté App : une
              borne seule marque le champ invalide sans rien empêcher. */}
            <input
              type="date"
              max={today}
              value={until}
              onChange={(event) => onUntilChange(event.target.value)}
            />
          </label>
        </div>

        {/* Proposé seulement s'il élargit vraiment la période demandée. */}
        {channelCreatedAt && channelCreatedAt < since && (
          <button type="button" className="link" onClick={() => onSinceChange(channelCreatedAt)}>
            Remonter à la création de la chaîne ({channelCreatedAt})
          </button>
        )}

        <button
          type="button"
          className={connected && !running ? 'primary wide' : 'wide'}
          onClick={onRun}
        >
          {running ? 'Arrêter la fouille' : 'Lancer la fouille'}
        </button>
      </div>
    </aside>
  )
}
