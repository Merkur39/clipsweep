import type { T } from '../i18n/translate'

export type AccessKind = 'ok' | 'bad' | ''

export interface AccessInput {
  /** The refusal Twitch just returned on the redirect, if there is one. */
  authError: string | null
  clientId: string
  /** A token is already in store — kept from an earlier visit, unconfirmed. */
  hasStoredToken: boolean
  /** The URL to declare on Twitch's side, quoted when the app is unconfigured. */
  redirectUri: string
}

export interface AccessState {
  message: string
  kind: AccessKind
  /**
   * We call ourselves connected on the strength of the stored token, before any
   * confirmation. The caller takes it back if `/oauth2/validate` disagrees.
   */
  presumedConnected: boolean
}

/**
 * The access state as it is knowable **without waiting on the network**.
 *
 * `tokenStore.read()` is synchronous: on the first render we already know
 * whether a token exists. Announcing "no token" for the duration of the round
 * trip to `/oauth2/validate` is false, and makes the block blink on every reload.
 *
 * The bet is optimistic rather than cautious: a waiting state lasts one request,
 * nobody has time to read it, it only produces a flicker. The nominal case — a
 * still-valid token — therefore displays correctly, and only the degraded case
 * corrects itself afterwards, in red, where the correction is visible.
 */
export function describeAccess(
  { authError, clientId, hasStoredToken, redirectUri }: AccessInput,
  t: T,
): AccessState {
  // A refusal just received describes the situation better than a leftover
  // token: presuming a connection on top of it would be a lie, not a bet.
  if (authError) {
    return {
      message: t('access.refused', { error: authError }),
      kind: 'bad',
      presumedConnected: false,
    }
  }

  // Misconfigured self-hosting: without an id no button can do anything — so say
  // right away what to fill in, and where.
  if (!clientId) {
    return {
      message: t('access.unconfigured', { redirectUri }),
      kind: 'bad',
      presumedConnected: false,
    }
  }

  // The same sentence validation will land on. A presumed session and a
  // confirmed one say the same thing now that the remaining life is no longer
  // spelled out, so nothing changes on screen when the round trip completes.
  if (hasStoredToken) {
    return { message: t('access.connected'), kind: 'ok', presumedConnected: true }
  }

  // The button just below carries the action: the status block only states the
  // state. Lamp off, not red — being disconnected is not an error.
  return { message: t('access.disconnected'), kind: '', presumedConnected: false }
}
