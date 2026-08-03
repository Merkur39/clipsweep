import { useTranslation } from '../i18n/LocaleProvider'

const REPOSITORY = 'https://github.com/Merkur39/clipsweep'

/**
 * Le pied de page : ce que l'outil doit dire de lui-même.
 *
 * Trois de ces quatre mentions ne sont pas décoratives.
 *
 * - **Le code source.** Chaque visiteur reçoit le bundle compilé, ce qui est une
 *   distribution du programme : la GPL-3.0 veut que la source correspondante lui
 *   soit offerte. Le dépôt est public depuis toujours, mais rien dans
 *   l'application n'y menait.
 * - **La non-affiliation.** Le produit ne porte plus de marque de Twitch, mais il
 *   la nomme partout en description ; le dire lève l'ambiguïté qui reste.
 * - **La mesure d'audience.** Elle est anonyme et sans cookie, ce qui n'oblige
 *   probablement pas à demander un consentement — mais l'annoncer reste dû.
 * - **Les clips appartiennent à leurs auteurs.** L'outil énumère et prépare un
 *   téléchargement ; ce qui en est fait ensuite regarde celui qui le lance.
 *
 * Aucune page dédiée : l'application n'a pas de routeur, et une mention légale
 * qu'il faut aller chercher est une mention qu'on ne lit pas.
 */
export function Colophon() {
  const { t } = useTranslation()

  return (
    <footer className="colophon">
      <p className="colophon-links">
        {/* Nouvel onglet, comme partout ailleurs : quitter la page perdrait le
          scan en cours et les clips récupérés, qui ne vivent que dans la
          mémoire de l'application. */}
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
