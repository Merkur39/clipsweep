import type { ScriptFlavor } from '../domain/scripts'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { DownloadIcon } from './Icon'

export interface SelectionBarProps {
  selected: Clip[]
  /** Null when the visitor's platform could not be told — both scripts are then offered. */
  flavor: ScriptFlavor | null
  onDownloadScript: (target: ScriptFlavor) => void
  onExportCsv: () => void
  onExportJson: () => void
  onExportUrls: () => void
}

/**
 * What to do with what is kept, on a bar that floats over the readout.
 *
 * It exists only while something is selected, which is what lets it sit over
 * the clips rather than beside them: a panel reserving a corner of every screen
 * for an action nobody has reached yet is a panel that is empty most of the
 * time. Nothing is checked at the end of a sweep, so most of the time is
 * exactly what that would be.
 *
 * The three formats sit flat rather than behind an "Export" menu. Folding them
 * away would cost a click and hide from a first-time visitor that the list can
 * leave without the videos — and three words fit.
 */
export function SelectionBar({
  selected,
  flavor,
  onDownloadScript,
  onExportCsv,
  onExportJson,
  onExportUrls,
}: SelectionBarProps) {
  const { t } = useTranslation()
  if (selected.length === 0) return null

  const downloadLabel = t('export.download.some', { n: selected.length })

  return (
    <div className="selection-bar" role="region" aria-label={t('export.download.title')}>
      <div className="selection-actions">
        <span className="selection-count">
          {t('results.count.selected', { n: selected.length })}
        </span>

        <div className="selection-formats">
          <button type="button" onClick={onExportCsv}>
            CSV
          </button>
          <button type="button" onClick={onExportJson}>
            JSON
          </button>
          <button type="button" title={t('export.urlsHelp')} onClick={onExportUrls}>
            URLs
          </button>
        </div>

        {/* One button where the platform is known, two where it is not: guessing
            wrong hands a visitor a script their machine will not run, and a
            silent failure is worse than one extra choice. */}
        {(flavor ?? 'bat') === 'bat' && (
          <button
            type="button"
            className="primary"
            title={t('export.script.batHelp')}
            onClick={() => onDownloadScript('bat')}
          >
            <DownloadIcon />
            {flavor ? downloadLabel : t('export.script.bat')}
          </button>
        )}
        {(flavor ?? 'sh') === 'sh' && (
          <button
            type="button"
            className="primary"
            title={t('export.script.shHelp')}
            onClick={() => onDownloadScript('sh')}
          >
            <DownloadIcon />
            {flavor ? downloadLabel : t('export.script.sh')}
          </button>
        )}
      </div>

      {/* "Borrows, installing nothing" rather than "installs": the script takes
          yt-dlp for the length of the harvest and erases it on the way out.
          Saying so here avoids two misunderstandings — that it leaves something
          behind, and that a yt-dlp already present would be replaced.

          The sentence is cut into two keys around the link: translating a
          fragment per language stays safer than making the catalogue carry
          markup it has no way to describe. */}
      <p className="selection-note">
        {t('export.download.ledeBefore')}{' '}
        {/* New tab: leaving the page would lose the clips already collected,
            which live in the application's memory alone. */}
        <a href="https://github.com/yt-dlp/yt-dlp#readme" target="_blank" rel="noreferrer">
          yt-dlp
        </a>{' '}
        {t('export.download.ledeAfter')}
        {flavor && (
          <>
            {' · '}
            <button
              type="button"
              className="link"
              onClick={() => onDownloadScript(flavor === 'bat' ? 'sh' : 'bat')}
            >
              {flavor === 'bat' ? t('export.script.otherUnix') : t('export.script.otherWindows')}
            </button>
          </>
        )}
      </p>
    </div>
  )
}
