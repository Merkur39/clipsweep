import { THEMES, type Theme } from '../domain/theme'
import { useTranslation } from '../i18n/LocaleProvider'
import type { MessageKey } from '../i18n/messages.fr'
import { Icon, type IconName } from './Icon'

/**
 * The glyph carries the state, so it must name the state and not the act: the
 * monitor is "follow the system", not "open the settings". No glyph is drawn
 * for the resolved palette under `system` — the row says which choice is made,
 * and "whatever the system says" is one of the three choices.
 */
const OPTIONS: Record<Theme, { label: MessageKey; icon: IconName }> = {
  system: { label: 'theme.system', icon: 'monitor' },
  light: { label: 'theme.light', icon: 'sun' },
  dark: { label: 'theme.dark', icon: 'moon' },
}

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

/**
 * Three buttons, not a cycle: a switch that rotates forces a click to discover
 * what it will do, and never says which of the three states is the current one.
 * Here the state reads without acting — the same rule as the lamp.
 *
 * The label is only visible to the keyboard and the screen reader: the row is a
 * display preference, it must not weigh as much as the task.
 *
 * `.seg icons` rather than plain `.seg`: the padding of the segment houses a
 * word, and there is none here — the icon variant takes it back on the sides so
 * three glyphs do not read as three empty pills. No geometry is written here;
 * it belongs to the sheet, where the two variants stay in step.
 */
export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="seg icons" role="group" aria-label={t('theme.label')}>
      {THEMES.map((option) => {
        const { label, icon } = OPTIONS[option]
        return (
          <button
            key={option}
            type="button"
            aria-pressed={option === theme}
            title={t(label)}
            onClick={() => onChange(option)}
          >
            <Icon name={icon} />
            <span className="visually-hidden">{t(label)}</span>
          </button>
        )
      })}
    </div>
  )
}
