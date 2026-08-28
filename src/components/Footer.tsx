import { useTranslation } from '../i18n/LocaleProvider'

const REPOSITORY = 'https://github.com/Merkur39/clipsweep'

/**
 * Not a translated message, and not a formatted year.
 *
 * A symbol, a year and a name read the same in both languages, so a key would
 * buy two entries that could only ever drift apart. And the year is the one the
 * work was published in — not today's: read off a clock it would advance on its
 * own, every 1 January, over a program nobody touched.
 */
const COPYRIGHT = '© 2026 Merkur39'

/**
 * The footer: what the tool owes about itself.
 *
 * Four of these five mentions are not decorative.
 *
 * - **The source code.** Every visitor receives the compiled bundle, which is a
 *   distribution of the program: the GPL-3.0 wants the corresponding source
 *   offered to them. The repository has always been public, but nothing in the
 *   application led there.
 * - **The copyright.** The other half of the same obligation: the link above
 *   says under what terms the program is licensed, and this says whose work is
 *   being licensed. A licence with no holder names nobody to grant it.
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
export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="footer">
      <p className="footer-links">
        {/* New tab, as everywhere else: leaving the page would lose the running
          search and the clips collected, which live in the application's memory
          alone. */}
        <a href={REPOSITORY} target="_blank" rel="noreferrer">
          {t('footer.source')}
        </a>
        <a href="https://github.com/yt-dlp/yt-dlp#readme" target="_blank" rel="noreferrer">
          yt-dlp
        </a>
        <a href="https://dev.twitch.tv/docs/api/" target="_blank" rel="noreferrer">
          {t('footer.twitchApi')}
        </a>
      </p>
      <p className="footer-note">
        {t('footer.independent')} <br />
        {t('footer.ownership')} <br />
        {t('footer.analytics')}
      </p>
      {/* Last, and on a line of its own: the three notes above disclaim what
          the tool is not, where this one asserts. It is the only line of the
          footer that does not change with the language. */}
      <p className="footer-copyright">{COPYRIGHT}</p>
    </footer>
  )
}
