import { useTranslation } from '../i18n/LocaleProvider'

const REPOSITORY = 'https://github.com/Merkur39/clipsweep'

/**
 * The footer: what the tool owes about itself.
 *
 * Three of these four mentions are not decorative.
 *
 * - **The source code.** Every visitor receives the compiled bundle, which is a
 *   distribution of the program: the GPL-3.0 wants the corresponding source
 *   offered to them. The repository has always been public, but nothing in the
 *   application led there.
 * - **The non-affiliation.** The product no longer carries any Twitch branding,
 *   but it names Twitch throughout its description; saying so clears what
 *   ambiguity is left.
 * - **The analytics.** It is anonymous and cookie-free, which probably does not
 *   require asking for consent — but announcing it is still owed.
 * - **Clips belong to their authors.** The tool enumerates and prepares a
 *   download; what is done with them afterwards is the business of whoever runs
 *   it.
 *
 * No dedicated page: the application has no router, and a legal notice you have
 * to go looking for is a notice nobody reads.
 */
export function Colophon() {
  const { t } = useTranslation()

  return (
    <footer className="colophon">
      <p className="colophon-links">
        {/* New tab, as everywhere else: leaving the page would lose the running
          sweep and the clips collected, which live in the application's memory
          alone. */}
        <a href={REPOSITORY} target="_blank" rel="noreferrer">
          {t('colophon.source')}
        </a>
        <a href="https://github.com/yt-dlp/yt-dlp#readme" target="_blank" rel="noreferrer">
          yt-dlp
        </a>
        <a href="https://dev.twitch.tv/docs/api/" target="_blank" rel="noreferrer">
          {t('colophon.twitchApi')}
        </a>
      </p>
      <p className="colophon-note">
        {t('colophon.independent')} <br />
        {t('colophon.ownership')} <br />
        {t('colophon.analytics')}
      </p>
    </footer>
  )
}
