import { AlertIcon, LogoutIcon } from './Icon'

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
  /** Le désordre que les bornes ne couvrent pas : début postérieur à la fin. */
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

        {/* Annoncé sous les champs fautifs, et non dans le seul journal — qui
          est replié par défaut. Le bouton de fouille est désactivé en même
          temps : un clic sans effet visible est ce qui rendait l'erreur
          introuvable.

          Toujours rendu, sa hauteur réservée en CSS : l'apparition du message
          ne doit décaler ni le bouton de fouille ni la suite du panneau. La
          région vive persistante est aussi ce qui fait annoncer le message par
          les lecteurs d'écran — un `role="alert"` inséré au moment de l'erreur
          passe souvent inaperçu. */}
        <p className="field-error" role="alert">
          {periodError && (
            <>
              <AlertIcon />
              <span>{periodError}</span>
            </>
          )}
        </p>

        {/* Proposé seulement s'il élargit vraiment la période demandée. Sa place
          reste tenue le reste du temps : il paraît et disparaît au gré de la
          chaîne saisie, sans quoi il pousserait le bouton de fouille à chaque
          frappe.

          « de la chaîne » est sous-entendu par le champ juste au-dessus et par
          l'étiquette « Cible » : le libellé long ne laissait que 9px de marge
          dans le rail, et serait passé à deux lignes sur une police
          d'interface plus large — la hauteur réservée aurait été dépassée. */}
        <p className="channel-hint">
          {channelCreatedAt && channelCreatedAt < since && (
            <button type="button" className="link" onClick={() => onSinceChange(channelCreatedAt)}>
              Remonter à la création ({channelCreatedAt})
            </button>
          )}
        </p>

        <button
          type="button"
          className={connected && !running ? 'primary wide' : 'wide'}
          onClick={onRun}
          disabled={periodError !== null}
        >
          {running ? 'Arrêter la fouille' : 'Lancer la fouille'}
        </button>
      </div>
    </aside>
  )
}
