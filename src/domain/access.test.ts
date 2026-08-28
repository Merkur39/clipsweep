import { describe, expect, it } from 'vitest'

import { describeAccess } from './access'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

const input = {
  authError: null,
  clientId: 'abc123',
  hasStoredToken: false,
  redirectUri: 'https://example.com/clipsweep/',
}

describe('describeAccess', () => {
  it('announces the refusal Twitch returned', () => {
    const state = describeAccess({ ...input, authError: 'access_denied' }, t)

    expect(state.message).toContain('access_denied')
    expect(state.kind).toBe('bad')
    expect(state.presumedConnected).toBe(false)
  })

  it('reports an unconfigured application, with the URL to declare', () => {
    const state = describeAccess({ ...input, clientId: '' }, t)

    expect(state.message).toContain('VITE_TWITCH_CLIENT_ID')
    expect(state.message).toContain('https://example.com/clipsweep/')
    expect(state.kind).toBe('bad')
  })

  // The token lives in sessionStorage: on a tab reload it is there before the
  // first render. We presume it valid, at the risk of taking it back — a
  // transient state lasting one round trip is not read, it only flickers.
  it('presumes the connection when a token is already stored', () => {
    const state = describeAccess({ ...input, hasStoredToken: true }, t)

    // Same prefix as the confirmed message, which will only add the duration.
    expect(state.message).toBe('Connecté')
    expect(state.presumedConnected).toBe(true)
    expect(state.kind).toBe('ok')
  })

  // The button just below reads "Connect to Twitch": repeating the instruction
  // here would push it onto two lines for nothing.
  it('states the state, without restating the action the button carries', () => {
    const state = describeAccess(input, t)

    expect(state.message).toBe('Déconnecté de Twitch')
    expect(state.presumedConnected).toBe(false)
    expect(state.kind).toBe('')
  })

  // A refusal just received describes the situation better than a leftover
  // token: presuming a connection after an "access_denied" would be a lie, not a
  // bet.
  it('makes the refusal win over a stored token', () => {
    const state = describeAccess({ ...input, authError: 'access_denied', hasStoredToken: true }, t)

    expect(state.kind).toBe('bad')
    expect(state.presumedConnected).toBe(false)
  })

  // Without an id no stored token can serve: the configuration fault is what
  // needs reading.
  it('makes the missing id win over a stored token', () => {
    const state = describeAccess({ ...input, clientId: '', hasStoredToken: true }, t)

    expect(state.message).toContain('VITE_TWITCH_CLIENT_ID')
    expect(state.presumedConnected).toBe(false)
  })
})
