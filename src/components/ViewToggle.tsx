import { VIEWS, type View } from '../domain/view'
import { useTranslation } from '../i18n/LocaleProvider'
import type { MessageKey } from '../i18n/messages.fr'
import { GridIcon, GridTightIcon, RowsIcon } from './Icon'

/**
 * In this order, and it is the order of the densities themselves: the largest
 * images first, the table last. A control whose positions run along one
 * quantity has to be laid out along it, or nothing says which way is denser.
 */
const OPTIONS: Record<View, { label: MessageKey; icon: () => React.ReactElement }> = {
  large: { label: 'view.large', icon: GridIcon },
  grid: { label: 'view.grid', icon: GridTightIcon },
  table: { label: 'view.table', icon: RowsIcon },
}

interface ViewToggleProps {
  view: View
  onChange: (view: View) => void
}

/**
 * One button per density rather than one switch, the same rule as the theme and
 * the language: a control that cycles forces a click to find out what it does,
 * and never says which state is the current one.
 *
 * It is filed at the end of the "Results" label because that is what it
 * governs — the readout below, not the page.
 */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="segmented view-toggle" role="group" aria-label={t('view.label')}>
      {VIEWS.map((option, index) => {
        const { label, icon: Icon } = OPTIONS[option]
        /* The key that works it, named rather than drawn: three digits set
           beside three icons would half again the width of a control that is
           read at a glance, and the digit is the least of what it says. It is
           in the tooltip and in the accessible name, which is where a reader
           looking for it will look. */
        const named = t('shortcut.on', { label: t(label), key: String(index + 1) })
        return (
          <button
            key={option}
            type="button"
            data-view={option}
            aria-pressed={option === view}
            title={named}
            onClick={() => onChange(option)}
          >
            <Icon />
            <span className="visually-hidden">{named}</span>
          </button>
        )
      })}
    </div>
  )
}
