import type { ScriptFlavor } from '../domain/scripts'
import type { Clip } from '../twitch/types'

export interface ExportPanelProps {
  selected: Clip[]
  clipsFound: number
  /** Null when the visitor's platform could not be told — both scripts are then offered. */
  flavor: ScriptFlavor | null
  onDownloadScript: (target: ScriptFlavor) => void
  onExportCsv: () => void
  onExportJson: () => void
  onExportUrls: () => void
}

export function ExportPanel({
  selected,
  clipsFound,
  flavor,
  onDownloadScript,
  onExportCsv,
  onExportJson,
  onExportUrls,
}: ExportPanelProps) {
  const empty = selected.length === 0
  const downloadLabel = empty
    ? 'Télécharger les clips'
    : `Télécharger ${selected.length === 1 ? 'le clip' : `les ${selected.length} clips`}`

  return (
    <>
      <section className="group">
        <h2>Télécharger les vidéos</h2>
        {/* « Sans rien installer » plutôt que « installe » : le script emprunte
          yt-dlp le temps de la récolte et l'efface en partant. Le dire ici
          évite deux malentendus — qu'il laisse quelque chose derrière lui, et
          qu'un yt-dlp déjà présent serait remplacé. */}
        <p className="group-lede">
          Un script à lancer sur ta machine : il récupère{' '}
          {/* Nouvel onglet : quitter la page perdrait les clips déjà récupérés,
            qui ne vivent que dans la mémoire de l'application. */}
          <a href="https://github.com/yt-dlp/yt-dlp#readme" target="_blank" rel="noreferrer">
            yt-dlp
          </a>{' '}
          au besoin sans rien installer, puis télécharge les clips.
        </p>
        <div className="group-actions">
          {(flavor ?? 'bat') === 'bat' && (
            <button
              type="button"
              className={flavor && !empty ? 'primary' : ''}
              disabled={empty}
              title="Enregistrer dans un dossier, puis double-cliquer."
              onClick={() => onDownloadScript('bat')}
            >
              {flavor ? downloadLabel : 'Script Windows (.bat)'}
            </button>
          )}
          {(flavor ?? 'sh') === 'sh' && (
            <button
              type="button"
              className={flavor && !empty ? 'primary' : ''}
              disabled={empty}
              title="Enregistrer, puis : chmod +x fichier.sh && ./fichier.sh"
              onClick={() => onDownloadScript('sh')}
            >
              {flavor ? downloadLabel : 'Script macOS · Linux (.sh)'}
            </button>
          )}
        </div>
        {flavor && (
          <p className="hint">
            {flavor === 'bat'
              ? 'Script Windows (.bat) — enregistrer dans un dossier, puis double-cliquer. '
              : 'Script macOS · Linux (.sh) — enregistrer, puis chmod +x et lancer. '}
            <br />
            <button
              type="button"
              className="link"
              disabled={empty}
              onClick={() => onDownloadScript(flavor === 'bat' ? 'sh' : 'bat')}
            >
              {flavor === 'bat' ? 'Je suis sur macOS ou Linux' : 'Je suis sur Windows'}
            </button>
          </p>
        )}
      </section>

      <section className="group">
        <h2>Exporter la liste</h2>
        <p className="group-lede">
          Les métadonnées des clips, sans les vidéos — pour un tableur ou un autre outil.
        </p>
        <div className="group-actions">
          <button type="button" disabled={empty} onClick={onExportCsv}>
            CSV
          </button>
          <button type="button" disabled={empty} onClick={onExportJson}>
            JSON
          </button>
          <button
            type="button"
            disabled={empty}
            title="Une URL par ligne, pour yt-dlp -a"
            onClick={onExportUrls}
          >
            URLs
          </button>
          <span className="count">
            {clipsFound
              ? `${selected.length} sélectionné${selected.length > 1 ? 's' : ''} sur ${clipsFound} récupéré${clipsFound > 1 ? 's' : ''}`
              : ''}
          </span>
        </div>
      </section>
    </>
  )
}
