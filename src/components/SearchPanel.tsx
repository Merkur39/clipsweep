export interface SearchPanelProps {
  authMessage: string
  authKind: 'ok' | 'bad' | ''
  connected: boolean
  canConnect: boolean
  onConnect: () => void

  channel: string
  onChannelChange: (next: string) => void
  since: string
  onSinceChange: (next: string) => void
  until: string
  onUntilChange: (next: string) => void
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
  channel,
  onChannelChange,
  since,
  onSinceChange,
  until,
  onUntilChange,
  channelCreatedAt,
  running,
  onRun,
}: SearchPanelProps) {
  return (
    <aside className="rail">
      <div className="rail-inner">
        <p className="section-label">Accès</p>
        <div className={`status ${authKind}`}>{authMessage}</div>
        {/* L'emphase suit ce qu'il reste à faire : une fois connecté, le bouton
          le plus lourd de la page ne peut pas être celui qui est désactivé. */}
        <button
          type="button"
          className={connected ? 'wide' : 'primary wide'}
          onClick={onConnect}
          disabled={connected || !canConnect}
        >
          {connected ? 'Connecté à Twitch' : 'Se connecter à Twitch'}
        </button>

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
            <input
              type="date"
              value={since}
              onChange={(event) => onSinceChange(event.target.value)}
            />
          </label>
          <label>
            <span>Jusqu'au</span>
            <input
              type="date"
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
