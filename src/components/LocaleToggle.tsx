import { useTranslation } from '../i18n/LocaleProvider'
import { LOCALE_CHOICES, type Locale } from '../i18n/locales'

/**
 * Chaque langue se nomme **dans sa propre langue**, et n'est donc pas dans le
 * catalogue : celui qui tombe sur une interface qu'il ne lit pas doit pouvoir y
 * reconnaître la sienne, ce que « Anglais » ne dit à aucun anglophone.
 *
 * Le code à deux lettres tient lieu de pastille, comme l'icône dans la rangée
 * des thèmes : le nom complet reste au lecteur d'écran et à l'infobulle.
 */
const NAMES: Record<Locale, { full: string; short: string }> = {
  fr: { full: 'Français', short: 'FR' },
  en: { full: 'English', short: 'EN' },
}

/**
 * Le pendant de [ThemeToggle], et pour les mêmes raisons : trois boutons plutôt
 * qu'un cycle, l'état lisible sans agir, et le libellé réservé au clavier et au
 * lecteur d'écran.
 *
 * « Automatique » n'est pas une langue mais l'absence de choix — il suit le
 * navigateur, et reste donc enfoncé alors même que l'interface est en français.
 */
export function LocaleToggle() {
  const { choice, setChoice, t } = useTranslation()

  return (
    <div className="segmented" role="group" aria-label={t('locale.label')}>
      {LOCALE_CHOICES.map((option) => {
        const { full, short } =
          option === 'auto' ? { full: t('locale.auto'), short: 'Auto' } : NAMES[option]

        return (
          <button
            key={option}
            type="button"
            aria-pressed={option === choice}
            title={full}
            onClick={() => setChoice(option)}
          >
            <span aria-hidden="true">{short}</span>
            <span className="visually-hidden">{full}</span>
          </button>
        )
      })}
    </div>
  )
}
