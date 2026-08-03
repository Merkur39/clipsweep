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
 * Trois boutons, pas un cycle : un interrupteur qui tourne oblige à cliquer
 * pour découvrir ce qu'il fera, et ne dit jamais lequel des trois états est le
 * courant. Ici l'état se lit sans agir — c'est la même règle que la lampe.
 *
 * Le libellé n'est visible qu'au clavier et au lecteur d'écran : la rangée est
 * une préférence d'affichage, elle ne doit pas peser autant que la tâche.
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
