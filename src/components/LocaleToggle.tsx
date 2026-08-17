import { useTranslation } from '../i18n/LocaleProvider'
import { LOCALE_CHOICES, type Locale } from '../i18n/locales'

/**
 * Every language names itself **in its own language**, and is therefore not in
 * the catalogue: someone landing on an interface they cannot read must be able
 * to recognize their own, which "Anglais" tells no English speaker.
 *
 * The two-letter code stands in for the pip, like the icon in the theme row: the
 * full name is left to the screen reader and the tooltip.
 */
const NAMES: Record<Locale, { full: string; short: string }> = {
  fr: { full: 'Français', short: 'FR' },
  en: { full: 'English', short: 'EN' },
}

/**
 * The counterpart of [ThemeToggle], and for the same reasons: three buttons
 * rather than a cycle, the state readable without acting, and the label reserved
 * for the keyboard and the screen reader.
 *
 * "Automatic" is not a language but the absence of a choice — it follows the
 * browser, and therefore stays pressed even while the interface is in French.
 *
 * Plain `.seg`, not the `icons` variant its neighbour takes: the code *is* the
 * visible text, and a word needs the padding that houses a word. Two segments
 * side by side in the bar therefore differ in width, which is correct — one
 * carries three glyphs, the other three labels.
 */
export function LocaleToggle() {
  const { choice, setChoice, t } = useTranslation()

  return (
    <div className="seg" role="group" aria-label={t('locale.label')}>
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
