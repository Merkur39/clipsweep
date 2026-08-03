import { THEMES, type Theme } from '../domain/theme'
import { useTranslation } from '../i18n/LocaleProvider'
import type { MessageKey } from '../i18n/messages.fr'
import { MoonIcon, SunIcon, SystemIcon } from './Icon'

const OPTIONS: Record<Theme, { label: MessageKey; icon: () => React.ReactElement }> = {
  system: { label: 'theme.system', icon: SystemIcon },
  light: { label: 'theme.light', icon: SunIcon },
  dark: { label: 'theme.dark', icon: MoonIcon },
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
 */
export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="segmented" role="group" aria-label={t('theme.label')}>
      {THEMES.map((option) => {
        const { label, icon: Icon } = OPTIONS[option]
        return (
          <button
            key={option}
            type="button"
            aria-pressed={option === theme}
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
