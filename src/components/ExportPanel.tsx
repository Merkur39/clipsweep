import type { ScriptFlavor } from '../domain/scripts'
import { useTranslation } from '../i18n/LocaleProvider'
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
  const { t } = useTranslation()
  const empty = selected.length === 0
  const downloadLabel = empty
    ? t('export.download.all')
    : t('export.download.some', { n: selected.length })

  return (
    <>
      <section className="group">
        <h2>{t('export.download.title')}</h2>
        {/* "Installing nothing" rather than "installs": the script borrows
          yt-dlp for the length of the harvest and erases it on the way out.
          Saying so here avoids two misunderstandings — that it leaves something
          behind, and that a yt-dlp already present would be replaced.

          The sentence is cut into two keys around the link: translating a
          sentence fragment per language stays safer than making the catalogue
          carry markup it has no way to describe. */}
        <p className="group-lede">
          {t('export.download.ledeBefore')}{' '}
          {/* New tab: leaving the page would lose the clips already collected,
            which live in the application's memory alone. */}
          <a href="https://github.com/yt-dlp/yt-dlp#readme" target="_blank" rel="noreferrer">
            yt-dlp
          </a>{' '}
          {t('export.download.ledeAfter')}
        </p>
        <div className="group-actions">
          {(flavor ?? 'bat') === 'bat' && (
            <button
              type="button"
              className={flavor && !empty ? 'primary' : ''}
              disabled={empty}
              title={t('export.script.batHelp')}
              onClick={() => onDownloadScript('bat')}
            >
              {flavor ? downloadLabel : t('export.script.bat')}
            </button>
          )}
          {(flavor ?? 'sh') === 'sh' && (
            <button
              type="button"
              className={flavor && !empty ? 'primary' : ''}
              disabled={empty}
              title={t('export.script.shHelp')}
              onClick={() => onDownloadScript('sh')}
            >
              {flavor ? downloadLabel : t('export.script.sh')}
            </button>
          )}
        </div>
        {flavor && (
          <p className="hint">
            {flavor === 'bat' ? t('export.script.batHint') : t('export.script.shHint')} <br />
            <button
              type="button"
              className="link"
              disabled={empty}
              onClick={() => onDownloadScript(flavor === 'bat' ? 'sh' : 'bat')}
            >
              {flavor === 'bat' ? t('export.script.otherUnix') : t('export.script.otherWindows')}
            </button>
          </p>
        )}
      </section>

      <section className="group">
        <h2>{t('export.list.title')}</h2>
        <p className="group-lede">{t('export.list.lede')}</p>
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
            title={t('export.urlsHelp')}
            onClick={onExportUrls}
          >
            URLs
          </button>
          <span className="count">
            {clipsFound
              ? t('export.tally', {
                  selected: t('results.count.selected', { n: selected.length }),
                  found: t('export.tallyFound', { n: clipsFound }),
                })
              : ''}
          </span>
        </div>
      </section>
    </>
  )
}
