import { MoonIcon, SunIcon, SystemIcon } from './Icon'
import { THEMES, type Theme } from '../domain/theme'

const OPTIONS: Record<Theme, { label: string; icon: () => React.ReactElement }> = {
  system: { label: 'Système', icon: SystemIcon },
  light: { label: 'Clair', icon: SunIcon },
  dark: { label: 'Sombre', icon: MoonIcon },
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
  return (
    <div className="theme-toggle" role="group" aria-label="Thème">
      {THEMES.map((option) => {
        const { label, icon: Icon } = OPTIONS[option]
        return (
          <button
            key={option}
            type="button"
            aria-pressed={option === theme}
            title={label}
            onClick={() => onChange(option)}
          >
            <Icon />
            <span className="visually-hidden">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
