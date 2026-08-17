import type { ScriptFlavor } from '../domain/scripts'
import { Icon } from './Icon'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'

export interface ExportPanelProps {
  selected: Clip[]
  /** No longer read: the dock counts the selection alone, and the tally line it
   *  fed disappeared with the two prose blocks. Kept so the caller's signature
   *  does not move under an unrelated migration. */
  clipsFound: number
  /** Null when the visitor's platform could not be told — both scripts are then offered. */
  flavor: ScriptFlavor | null
  onDownloadScript: (target: ScriptFlavor) => void
  onExportCsv: () => void
  onExportJson: () => void
  onExportUrls: () => void
}

/**
 * The export dock. It sits in the flow, between the result and the statistics
 * drawer, and that placement is the whole point: unlike the sweep banner it
 * holds its own ground and never covers a row the visitor is reading.
 *
 * A dock has no room for prose, so the headings and the ledes are gone. The
 * yt-dlp link they carried lives in the colophon, which already names it — one
 * link in one place beats the same link in two.
 */
export function ExportPanel({
  selected,
  flavor,
  onDownloadScript,
  onExportCsv,
  onExportJson,
  onExportUrls,
}: ExportPanelProps) {
  const { t } = useTranslation()
  const empty = selected.length === 0
  const downloadLabel = empty
    ? t('export.download.none')
    : t('export.download.some', { n: selected.length })

  /* The flavour that is *not* the visitor's, read only once `flavor` is known.
     With no platform told, both scripts are offered side by side instead and
     this never comes up. */
  const other: ScriptFlavor = flavor === 'bat' ? 'sh' : 'bat'

  /* Written twice, and the pair is not redundant: `disabled` is what refuses
     the click and drops the button out of the tab order, `aria-disabled` is
     what the sheet hangs the unavailable state off — CSS cannot read the DOM
     property. The annotation is what keeps the value from widening to `string`,
     which React's aria typing rejects. */
  const unavailable: { disabled: boolean; 'aria-disabled': 'true' | 'false' } = {
    disabled: empty,
    'aria-disabled': empty ? 'true' : 'false',
  }

  return (
    <div className="dock">
      {/* The count leads, and every button beside it acts on it — an action
        reads better once its object is already named. */}
      <span className="n">{t('results.count.selected', { n: selected.length })}</span>
      <span className="sep" />

      {/* Platform told: one filled button that downloads the right flavour.
        Platform unknown: the two scripts, neither of them filled — a dock
        carries at most one primary, and nothing here prefers either. */}
      {flavor === null ? (
        <>
          <button
            type="button"
            className="dbtn script"
            {...unavailable}
            title={t('export.script.batHelp')}
            onClick={() => onDownloadScript('bat')}
          >
            {t('export.script.bat')}
          </button>
          <button
            type="button"
            className="dbtn script"
            {...unavailable}
            title={t('export.script.shHelp')}
            onClick={() => onDownloadScript('sh')}
          >
            {t('export.script.sh')}
          </button>
        </>
      ) : (
        <button
          type="button"
          /* The fill is dropped as soon as nothing is selected. A blue-filled
             button that does nothing reads as actionable, and the label says
             the opposite — the two must not contradict each other. */
          className={empty ? 'dbtn script' : 'dbtn script primary'}
          {...unavailable}
          title={flavor === 'bat' ? t('export.script.batHelp') : t('export.script.shHelp')}
          onClick={() => onDownloadScript(flavor)}
        >
          {/* No size passed: the sheet sizes the dock button's glyph, and an
            override here would fork that decision into two files. */}
          <Icon name="down" />
          {downloadLabel}
        </button>
      )}

      <button type="button" className="dbtn" {...unavailable} onClick={onExportCsv}>
        CSV
      </button>
      <button type="button" className="dbtn" {...unavailable} onClick={onExportJson}>
        JSON
      </button>
      <button
        type="button"
        className="dbtn"
        {...unavailable}
        title={t('export.urlsHelp')}
        onClick={onExportUrls}
      >
        URLs
      </button>

      {/* The other flavour stays reachable — a visitor on Linux behind a
        Windows user agent must not be told the wrong script is the only one.
        Last in the row rather than beside the primary: it is a fallback, not a
        peer of the three list exports, and slotting it between the pills would
        cut the button row in two. Its title carries what the dropped hint
        paragraph used to say about running the file. */}
      {flavor !== null && (
        <button
          type="button"
          className="quiet script"
          {...unavailable}
          title={other === 'sh' ? t('export.script.shHelp') : t('export.script.batHelp')}
          onClick={() => onDownloadScript(other)}
        >
          {flavor === 'bat' ? t('export.script.otherUnix') : t('export.script.otherWindows')}
        </button>
      )}
    </div>
  )
}
