import { Analytics } from '@vercel/analytics/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { applyTheme, parseTheme } from './domain/theme'
import { forgetSessionScopedKeys, persistedKey } from './hooks/usePersistedState'
import { LocaleProvider } from './i18n/LocaleProvider'
import { applyLocale, parseLocaleChoice, resolveLocale } from './i18n/locales'
import { captureRedirect } from './twitch/auth'
import './styles/index.css'

// Consume the OAuth fragment before the app renders, so the URL is clean and
// the token is already in place on first paint.
const authError = captureRedirect()

// Avant le rendu, pour la même raison : sans préférence enregistrée le CSS
// tranche déjà seul, mais un choix qui contredit le système doit être posé
// avant que la page se peigne, sinon il s'y voit arriver.
applyTheme(document.documentElement, parseTheme(localStorage.getItem(persistedKey('theme'))))

// Même raison, autre sens : `index.html` code `lang="fr"` en dur, valeur que le
// premier rendu contredirait pour un visiteur anglophone. L'attribut pilote la
// prononciation des lecteurs d'écran, qui le lisent au chargement.
applyLocale(
  document.documentElement,
  resolveLocale(
    parseLocaleChoice(localStorage.getItem(persistedKey('locale'))),
    navigator.languages,
  ),
)

// La cible et la période sont passées en `sessionStorage` : ce qu'une version
// précédente avait laissé dans le stockage durable n'y est plus relu, et n'a
// donc plus de raison d'y rester.
forgetSessionScopedKeys(localStorage)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App authError={authError} />
    </LocaleProvider>
    {/* Mesure d'audience Vercel : elle charge son script depuis
        `/_vercel/insights/`, chemin que seul un déploiement Vercel sert —
        ailleurs la requête échoue sans conséquence. Rien de ce que le visiteur
        saisit ou récupère n'y passe : seulement la page vue. */}
    <Analytics />
  </StrictMode>,
)
