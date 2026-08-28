import { useId, useState } from 'react'

import type { ScriptFlavor } from '../domain/scripts'
import { useDismissable } from '../hooks/useDismissable'
import { useTranslation } from '../i18n/LocaleProvider'
import { ChevronIcon, CloseIcon, DownloadIcon } from './Icon'
import type { MessageKey } from '../i18n/messages.fr'

const SCRIPT_LABEL: Record<ScriptFlavor, MessageKey> = {
  bat: 'export.script.bat',
  sh: 'export.script.sh',
}

const SCRIPT_HELP: Record<ScriptFlavor, MessageKey> = {
  bat: 'export.script.batHelp',
  sh: 'export.script.shHelp',
}

/**
 * What to do with the file once it is on the machine — which is not the same
 * sentence as the one in the menu. There, the script has not been fetched yet
 * and the reader is choosing; here it has landed, and the only question left is
 * what to do with a file that is already in a folder.
 */
const HANDED_HELP: Record<ScriptFlavor, MessageKey> = {
  bat: 'export.handed.bat',
  sh: 'export.handed.sh',
}

export interface SelectionBarProps {
  /** How many clips are picked. The bar does not exist below one. */
  selected: number
  /** Null when the visitor's platform could not be told. */
  flavor: ScriptFlavor | null
  /**
   * The name each script lands under, built where the download is written so
   * there is one builder rather than two. The panel below quotes it in the
   * command it hands to a Unix visitor: the exact name is the useful half of
   * that line, and it is the one thing a generic help text cannot give.
   */
  scriptFiles: Record<ScriptFlavor, string>
  onDownloadScript: (target: ScriptFlavor) => void
  onExportCsv: () => void
  onExportJson: () => void
  onExportUrls: () => void
  onClear: () => void
}

/**
 * What can be done with what is picked, floating over the readout.
 *
 * It replaces two blocks filed at the foot of the page — as far from the clips
 * as a control can get, and standing there stating "no clip selected" for the
 * whole of every session that never picked one. A bar that appears with the
 * first tick says the same thing by being there, and says it beside the ticks.
 *
 * It is also where the picking gets undone: the ticket above only ever offers to
 * pick everything, so neither control ever has to say the other's word.
 */
export function SelectionBar({
  selected,
  flavor,
  scriptFiles,
  onDownloadScript,
  onExportCsv,
  onExportJson,
  onExportUrls,
  onClear,
}: SelectionBarProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  /** Which script was last handed over, or null while none has been. */
  const [handed, setHanded] = useState<ScriptFlavor | null>(null)
  const menuId = `${useId()}-menu`
  const rootRef = useDismissable<HTMLDivElement>(open, () => setOpen(false))

  if (selected === 0) return null

  /**
   * Downloading a script and saying what it is are one gesture, so they are one
   * function: the button and the menu both go through it, and neither can hand
   * over a file without the word that goes with it.
   */
  const hand = (target: ScriptFlavor) => () => {
    setOpen(false)
    setHanded(target)
    onDownloadScript(target)
  }

  /**
   * The scripts the menu carries: the other platform's when one was detected,
   * both when none was. No guess in that second case — a script downloaded for
   * the wrong platform is a file that does nothing on the machine it lands on.
   */
  const scripts: ScriptFlavor[] =
    flavor === null ? ['bat', 'sh'] : [flavor === 'bat' ? 'sh' : 'bat']

  const pick = (run: () => void) => () => {
    setOpen(false)
    run()
  }

  return (
    <div className="selection-bar" role="group" aria-label={t('selection.label')}>
      {/* What the file is and what to do with it, said where the question is
          asked: after the click, with the script already in a folder. Before it,
          this was one sentence inside a menu the primary path never opens — so
          the one button most visitors press handed over an executable and
          explained nothing. */}
      {handed && (
        <div className="handed" role="status">
          <p className="handed-title">{t('export.handed.title')}</p>
          <p>{t('export.download.help')}</p>
          <p className="handed-do">{t(HANDED_HELP[handed], { file: scriptFiles[handed] })}</p>
          <button
            type="button"
            className="handed-close"
            aria-label={t('export.handed.close')}
            onClick={() => setHanded(null)}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <p className="selection-count">{t('selection.count', { n: selected })}</p>

      {/* The one thing most visitors came for, and it needs no choosing: the
          platform is already known. Absent when it is not. */}
      {flavor && (
        <button type="button" className="primary" onClick={hand(flavor)}>
          <DownloadIcon />
          {t('export.download.action')}
        </button>
      )}

      <div className="menu-root" ref={rootRef}>
        <button
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(!open)}
        >
          {t('export.menu')}
          {/* Pointing the way the menu opens: the bar sits at the foot of the
              page, so its panel has nowhere to go but up. */}
          <ChevronIcon turn={180} />
        </button>

        {open && (
          <div className="menu" id={menuId} role="group" aria-label={t('export.menu')}>
            <p className="menu-help">{t('export.download.help')}</p>
            {scripts.map((script) => (
              <button key={script} type="button" className="menu-item" onClick={hand(script)}>
                {t(SCRIPT_LABEL[script])}
                <span>{t(SCRIPT_HELP[script])}</span>
              </button>
            ))}

            <p className="menu-help">{t('export.list.help')}</p>
            <button type="button" className="menu-item" onClick={pick(onExportCsv)}>
              CSV
            </button>
            <button type="button" className="menu-item" onClick={pick(onExportJson)}>
              JSON
            </button>
            <button type="button" className="menu-item" onClick={pick(onExportUrls)}>
              URLs
              <span>{t('export.urlsHelp')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Named rather than read: on a phone the label goes and the cross stays,
          and a button that keeps its name in the accessible tree loses nothing
          by losing its text. */}
      <button
        type="button"
        className="selection-clear"
        aria-label={t('results.deselectAll')}
        onClick={onClear}
      >
        <CloseIcon />
        <span>{t('results.deselectAll')}</span>
      </button>
    </div>
  )
}
