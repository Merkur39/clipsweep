import { VIEWS, type View } from '../domain/view'
import { useTranslation } from '../i18n/LocaleProvider'
import type { MessageKey } from '../i18n/messages.fr'
import { DenseGridIcon, GridIcon, RowsIcon } from './Icon'

const OPTIONS: Record<View, { label: MessageKey; icon: () => React.ReactElement }> = {
  large: { label: 'view.large', icon: GridIcon },
  dense: { label: 'view.dense', icon: DenseGridIcon },
  list: { label: 'view.list', icon: RowsIcon },
}

interface ViewToggleProps {
  view: View
  onChange: (view: View) => void
}

/**
 * Three buttons rather than one switch, the same rule as the theme and the
 * language: a control that cycles forces a click to find out what it does, and
 * never says which state is the current one.
 *
 * They run loosest to tightest — the two galleries adjacent, the rows last —
 * so the control reads as one axis of density rather than three unrelated
 * shapes. `VIEWS` carries that order; nothing here sorts.
 *
 * It is filed at the end of the "Results" label because that is what it
 * governs — the readout below, not the page.
 */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="segmented view-toggle" role="group" aria-label={t('view.label')}>
      {VIEWS.map((option) => {
        const { label, icon: Icon } = OPTIONS[option]
        return (
          <button
            key={option}
            type="button"
            aria-pressed={option === view}
            title={t(label)}
            onClick={() => onChange(option)}
          >
            <Icon />
            <span className="visually-hidden">{t(label)}</span>
          </button>
        )
      })}
    </div>
  )
}
