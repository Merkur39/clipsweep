const AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize'
const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate'

const TOKEN_KEY = 'getclip.token'
const CLIENT_ID_KEY = 'getclip.clientId'

export type AuthFragment =
  | { status: 'token'; accessToken: string }
  | { status: 'error'; message: string }
  | { status: 'none' }

/** Reads the `#access_token=…` payload the implicit flow appends on redirect. */
export function parseAuthFragment(hash: string): AuthFragment {
  const params = new URLSearchParams(hash.replace(/^#/, ''))

  const accessToken = params.get('access_token')
  if (accessToken) return { status: 'token', accessToken }

  const error = params.get('error')
  if (error) return { status: 'error', message: params.get('error_description') ?? error }

  return { status: 'none' }
}

export function authorizeUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    // No scope needed: the clips and users endpoints only require a valid token.
    scope: '',
  })
  return `${AUTHORIZE_URL}?${params}`
}

export interface Session {
  clientId: string
  accessToken: string
  expiresInSeconds: number
}

/** Confirms the token is still live and recovers the client id it was issued for. */
export async function validateToken(accessToken: string): Promise<Session> {
  const response = await fetch(VALIDATE_URL, { headers: { Authorization: `OAuth ${accessToken}` } })
  if (!response.ok) throw new Error('Jeton expiré ou révoqué.')

  const payload = (await response.json()) as { client_id: string; expires_in: number }
  return { clientId: payload.client_id, accessToken, expiresInSeconds: payload.expires_in }
}

export const tokenStore = {
  read: () => sessionStorage.getItem(TOKEN_KEY),
  write: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

export const clientIdStore = {
  read: () => localStorage.getItem(CLIENT_ID_KEY),
  write: (clientId: string) => localStorage.setItem(CLIENT_ID_KEY, clientId),
  clear: () => localStorage.removeItem(CLIENT_ID_KEY),
}

/**
 * The client id identifies the application, not the person — it is public by
 * design (it travels in the authorize URL and in every Helix header). One
 * registered app therefore serves every visitor, who each sign in with their own
 * Twitch account.
 *
 * The build-time value wins: the input field only exists when there is none, so
 * a stale localStorage entry would otherwise hijack the login with no way left
 * to clear it. The stored value is the self-hosting fallback.
 */
export function resolveClientId(stored: string | null, buildTime: string): string {
  return buildTime.trim() || stored?.trim() || ''
}

/** Registered at build time via `VITE_TWITCH_CLIENT_ID`; empty falls back to the field. */
export const BUILD_TIME_CLIENT_ID: string = import.meta.env.VITE_TWITCH_CLIENT_ID ?? ''

/**
 * Twitch matches the redirect URI byte for byte, so it has to be stable however
 * the page was reached: with or without the trailing slash, and whether or not
 * `index.html` is spelled out. Served from a project subpath (GitHub Pages),
 * that difference is what turns a working login into `redirect_mismatch`.
 */
export function normalizeRedirectUri(origin: string, pathname: string): string {
  const directory = pathname.replace(/[^/]*\.html?$/i, '')
  return origin + (directory.endsWith('/') ? directory : `${directory}/`)
}

/** The redirect URI must match the one registered on dev.twitch.tv, query-free. */
export function redirectUri(): string {
  return normalizeRedirectUri(location.origin, location.pathname)
}

/**
 * One-shot bootstrap, run before React mounts: stashes the token the implicit
 * flow left in the URL fragment and scrubs it from the address bar. Returns the
 * error message when Twitch denied the authorization.
 */
export function captureRedirect(): string | null {
  const fragment = parseAuthFragment(location.hash)
  if (fragment.status === 'none') return null

  history.replaceState(null, '', redirectUri())
  if (fragment.status === 'error') return fragment.message

  tokenStore.write(fragment.accessToken)
  return null
}
