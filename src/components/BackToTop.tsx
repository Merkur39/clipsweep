import { useMediaQuery } from '../hooks/useMediaQuery'
import { useScrolledPast } from '../hooks/useScrolledPast'
import { useTranslation } from '../i18n/LocaleProvider'
import { ArrowUpIcon } from './Icon'

/**
 * Half a screen, which is the moment the head of the page stops being in sight
 * and starts being a distance. Earlier and the control would stand over a
 * readout the reader can still see the top of; a whole screen later and it
 * would arrive after the scroll it is meant to spare.
 */
const APPEARS_PAST = 0.5

/**
 * The way back up, for a page that is one long list.
 *
 * It exists only once it has something to do, which is how it says what it is
 * for without a label: a control that sat there from the first paint would be
 * one more thing over the readout, disabled, explaining itself.
 *
 * Nothing catches the focus it loses on the way back, deliberately. The button
 * goes with the scroll it just did, focus falls back to the document, and the
 * next `Tab` starts from the top of the page — which is where the reader asked
 * to be.
 */
export function BackToTop() {
  const { t } = useTranslation()
  const scrolled = useScrolledPast(APPEARS_PAST)
  const still = useMediaQuery('(prefers-reduced-motion: reduce)')

  if (!scrolled) return null

  return (
    <button
      type="button"
      className="to-top"
      title={t('toTop.label')}
      onClick={() => window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })}
    >
      <ArrowUpIcon />
      <span className="visually-hidden">{t('toTop.label')}</span>
    </button>
  )
}
