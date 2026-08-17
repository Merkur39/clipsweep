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

function start(fixture = false) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LocaleProvider>
        <App authError={authError} fixture={fixture} />
      </LocaleProvider>
      {/* Vercel analytics: it loads its script from `/_vercel/insights/`, a path
          only a Vercel deployment serves — anywhere else the request fails without
          consequence. Nothing the visitor types or collects goes through it: only
          the page view. */}
      <Analytics />
    </StrictMode>,
  )
}

/**
 * The offline fixture: `?fake=demo` and the like, in development only.
 *
 * Two guards, and they do different work. `import.meta.env.DEV` is a literal
 * Rollup folds away, which takes the **dynamic import** with it — the module
 * never enters the production graph, rather than entering it and being shaken
 * afterwards. The query parameter is what keeps a normal `npm run dev` normal.
 *
 * The import is awaited before the first render because the fixture replaces
 * `fetch`, and the token check fires from an effect on mount: installing it
 * afterwards would let the first request leave for the real Twitch.
 */
if (import.meta.env.DEV) {
  const scenario = new URLSearchParams(location.search).get('fake')

  void import('./dev/fakeTwitch').then((fixture) => {
    // The token outlives the parameter that created it. Dropping it on a plain
    // load is what stops a stale fixture token from being sent to Twitch, which
    // would report an expired session with nothing on screen to explain it.
    if (!scenario) fixture.forgetFakeToken()
    else fixture.installFakeTwitch(scenario)

    // Whether this session's clips are a fixture's is decided here and passed
    // down, rather than read from the query inside the application: `src/dev/`
    // has to stay unreachable from the bundle, and the entry point is already
    // the one place that knows.
    start(Boolean(scenario))
  })
} else {
  start()
}
