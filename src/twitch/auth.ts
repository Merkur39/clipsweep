import { TranslatableError } from './errors'

const AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize'
const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate'
const REVOKE_URL = 'https://id.twitch.tv/oauth2/revoke'

const TOKEN_KEY = 'getclip.token'

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
  if (!response.ok) throw new TranslatableError('error.tokenInvalid')

  const payload = (await response.json()) as { client_id: string; expires_in: number }
  return { clientId: payload.client_id, accessToken, expiresInSeconds: payload.expires_in }
}

/**
 * Asks Twitch to invalidate the token now, rather than at its expiry.
 *
 * The endpoint takes the public client id and the token itself, and no secret —
 * which is what lets a browser-only app call it at all. Without it, signing out
 * only forgot the token here: it stayed good on Twitch's side for the remainder
 * of its sixty days, and "Disconnect" named an erasure rather than an end.
 *
 * Rejects when Twitch will not confirm. The caller forgets the token either way
 * — the click has to land whatever the network does — but it may not claim a
 * revocation that did not happen.
 */
export async function revokeToken(clientId: string, accessToken: string): Promise<void> {
  const response = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, token: accessToken }),
  })

  if (!response.ok) throw new TranslatableError('access.revokeFailed')
}

/**
 * Durable, unlike the channel and the period: a token is not a parameter of a
 * sweep but the right to run one at all, and signing in again at every visit
 * bought nothing. What it costs, a token outliving the tab on a shared machine,
 * is what `revokeToken` answers — the two go together and neither stands alone.
 * Durable without revocation would leave a sixty-day token with no way to end
 * it; revocation without durability would revoke what was about to die anyway.
 *
 * Not routed through `usePersistedState`: this is read once before React
 * mounts, by `captureRedirect`, and is nobody's render state.
 */
export const tokenStore = {
  read: () => localStorage.getItem(TOKEN_KEY),
  write: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/**
 * The one application every visitor signs in through, set at build time via
 * `VITE_TWITCH_CLIENT_ID`. Public by design — it travels in the authorize URL
 * and in every Helix header — and the tokens it mints carry no scope, so it
 * unlocks nothing beyond public data.
 *
 * Empty means the deployment is misconfigured, not that the visitor has
 * something to fill in: self-hosting goes through `.env.local`.
 */
export const BUILD_TIME_CLIENT_ID: string = import.meta.env.VITE_TWITCH_CLIENT_ID ?? ''

/**
 * Twitch matches the redirect URI byte for byte, so it has to be stable however
 * the page was reached: with or without the trailing slash, and whether or not
 * `index.html` is spelled out. Served from a subpath rather than a domain root,
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
