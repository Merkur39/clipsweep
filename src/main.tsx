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

// Before rendering, for the same reason: with no stored preference the CSS
// already decides on its own, but a choice that contradicts the system must be
// set before the page paints, otherwise it is seen arriving.
applyTheme(document.documentElement, parseTheme(localStorage.getItem(persistedKey('theme'))))

// Same reason, other direction: `index.html` hard-codes `lang="fr"`, a value the
// first render would contradict for an English-speaking visitor. The attribute
// drives screen-reader pronunciation, and they read it at load time.
applyLocale(
  document.documentElement,
  resolveLocale(
    parseLocaleChoice(localStorage.getItem(persistedKey('locale'))),
    navigator.languages,
  ),
)

// The target and the period have moved to `sessionStorage`: what a previous
// version left in durable storage is no longer read from there, and therefore
// has no reason to stay.
forgetSessionScopedKeys(localStorage)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App authError={authError} />
    </LocaleProvider>
    {/* Vercel analytics: it loads its script from `/_vercel/insights/`, a path
        only a Vercel deployment serves — anywhere else the request fails without
        consequence. Nothing the visitor types or collects goes through it: only
        the page view. */}
    <Analytics />
  </StrictMode>,
)
