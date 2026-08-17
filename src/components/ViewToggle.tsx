import { VIEWS, type View } from '../domain/view'
import { useTranslation } from '../i18n/LocaleProvider'
import type { MessageKey } from '../i18n/messages.fr'
import { Icon, type IconName } from './Icon'

const OPTIONS: Record<View, { label: MessageKey; icon: IconName }> = {
  table: { label: 'view.table', icon: 'rows' },
  grid: { label: 'view.grid', icon: 'grid' },
}

interface ViewToggleProps {
  view: View
  onChange: (view: View) => void
}

/**
 * Two buttons rather than one switch, the same rule as the theme and the
 * language: a control that cycles forces a click to find out what it does, and
 * never says which state is the current one.
 *
 * It is filed at the end of the "Results" label because that is what it
 * governs — the readout below, not the page.
 *
 * Glyph *and* word, unlike the two rows in the top bar: those two are chrome the
 * eye learns once and then skips, this one names two ways of reading the clips
 * and is met with the results already on screen. The word is therefore visible
 * and is the accessible name on its own — a `visually-hidden` copy beside it
 * would have the screen reader say "Table" twice.
 *
 * No `.view-toggle` any more: the placement belongs to the results head, which
 * spaces its children itself, and a control that carries its own margins cannot
 * be reused where the sweep banner needs it.
 */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="seg" role="group" aria-label={t('view.label')}>
      {VIEWS.map((option) => {
        const { label, icon } = OPTIONS[option]
        return (
          <button
            key={option}
            type="button"
            aria-pressed={option === view}
            title={t(label)}
            onClick={() => onChange(option)}
          >
            <Icon name={icon} />
            {t(label)}
          </button>
        )
      })}
    </div>
  )
}
