import { describe, expect, it } from 'vitest'

import { describeAccess, describeTokenLife } from './access'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

describe('describeTokenLife', () => {
  // A Twitch token lasts some sixty days: expressing it in hours gives "1477 h",
  // which does not read and spills onto two lines.
  it('counts in days beyond two days', () => {
    expect(describeTokenLife(5_317_200, t)).toBe('62 j restants')
  })

  it('counts in hours below two days', () => {
    expect(describeTokenLife(10_800, t)).toBe('3 h restantes')
  })

  it('counts in minutes below an hour', () => {
    expect(describeTokenLife(2_520, t)).toBe('42 min restantes')
  })

  it('switches to days at exactly forty-eight hours', () => {
    expect(describeTokenLife(172_800, t)).toBe('2 j restants')
  })

  it('agrees the singular', () => {
    expect(describeTokenLife(3_600, t)).toBe('1 h restante')
  })

  // Better to announce the last minute than "0 min".
  it('never drops below the minute', () => {
    expect(describeTokenLife(30, t)).toBe('1 min restante')
  })

  // The unit changes symbol between the two languages: "j" for jours, "d" for
  // days.
  it('serves the language’s own unit', () => {
    expect(describeTokenLife(5_317_200, makeT('en'))).toBe('62 d left')
  })
})

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
    expect(state.message).toBe('Connecté.')
    expect(state.presumedConnected).toBe(true)
    expect(state.kind).toBe('ok')
  })

  // The button just below reads "Connect to Twitch": repeating the instruction
  // here would push it onto two lines for nothing.
  it('states the state, without restating the action the button carries', () => {
    const state = describeAccess(input, t)

    expect(state.message).toBe('Déconnecté de Twitch.')
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
