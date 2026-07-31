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

/**
 * The client id identifies the application, not the person — it is public by
 * design (it travels in the authorize URL and in every Helix header), so keeping
 * it in localStorage is fine. Each visitor registers their own application and
 * signs in with their own Twitch account.
 */
export const clientIdStore = {
  read: () => localStorage.getItem(CLIENT_ID_KEY) ?? '',
  write: (clientId: string) => localStorage.setItem(CLIENT_ID_KEY, clientId),
}

/** The redirect URI must match the one registered on dev.twitch.tv, query-free. */
export function redirectUri(): string {
  return location.origin + location.pathname
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
