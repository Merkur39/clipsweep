import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  authorizeUrl,
  normalizeRedirectUri,
  parseAuthFragment,
  revokeToken,
  tokenStore,
} from './auth'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('parseAuthFragment', () => {
  it('extracts the access token returned by the implicit flow', () => {
    const result = parseAuthFragment('#access_token=abc123&scope=&token_type=bearer')

    expect(result).toEqual({ status: 'token', accessToken: 'abc123' })
  })

  it('surfaces the error description when Twitch refuses', () => {
    const result = parseAuthFragment('#error=access_denied&error_description=User+denied')

    expect(result).toEqual({ status: 'error', message: 'User denied' })
  })

  it('falls back to the raw error code when no description is given', () => {
    expect(parseAuthFragment('#error=access_denied')).toEqual({
      status: 'error',
      message: 'access_denied',
    })
  })

  it('ignores a fragment that carries no auth payload', () => {
    expect(parseAuthFragment('')).toEqual({ status: 'none' })
    expect(parseAuthFragment('#section=results')).toEqual({ status: 'none' })
  })
})

describe('normalizeRedirectUri', () => {
  it('keeps a root path untouched', () => {
    expect(normalizeRedirectUri('http://localhost:5173', '/')).toBe('http://localhost:5173/')
  })

  it('keeps a project subpath served with its trailing slash', () => {
    expect(normalizeRedirectUri('https://example.com', '/clipsweep/')).toBe(
      'https://example.com/clipsweep/',
    )
  })

  it('adds the trailing slash when the subpath is reached without one', () => {
    expect(normalizeRedirectUri('https://example.com', '/clipsweep')).toBe(
      'https://example.com/clipsweep/',
    )
  })

  it('drops an explicit html filename', () => {
    expect(normalizeRedirectUri('https://example.com', '/clipsweep/index.html')).toBe(
      'https://example.com/clipsweep/',
    )
  })
})

describe('authorizeUrl', () => {
  it('builds the implicit grant URL for the given client and redirect', () => {
    const url = new URL(authorizeUrl('cid42', 'http://localhost:5173/'))

    expect(url.origin + url.pathname).toBe('https://id.twitch.tv/oauth2/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'cid42',
      redirect_uri: 'http://localhost:5173/',
      response_type: 'token',
      scope: '',
    })
  })
})

describe('revokeToken', () => {
  const accept = () => Promise.resolve({ ok: true, status: 200 } as Response)

  /** Typed on the two arguments the call under test passes, so they read back. */
  const stubFetch = (answer = accept) => {
    const mock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(answer)
    vi.stubGlobal('fetch', mock)
    return mock
  }

  it('asks Twitch to drop the token, naming the client it was minted for', async () => {
    const fetchMock = stubFetch()

    await revokeToken('cid42', 'abc123')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://id.twitch.tv/oauth2/revoke')
    expect(init.method).toBe('POST')
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      client_id: 'cid42',
      token: 'abc123',
    })
  })

  it('carries no secret: revocation is open to the public client', async () => {
    const fetchMock = stubFetch()

    await revokeToken('cid42', 'abc123')

    const body = String(fetchMock.mock.calls[0][1].body)
    expect(body).not.toMatch(/secret/i)
  })

  // The caller forgets the token either way; what it may not do is claim a
  // revocation Twitch never granted.
  it('reports a refusal rather than passing it off as done', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 400 } as Response)),
    )

    await expect(revokeToken('cid42', 'abc123')).rejects.toThrow()
  })

  it('reports a network failure the same way', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )

    await expect(revokeToken('cid42', 'abc123')).rejects.toThrow()
  })
})

describe('tokenStore', () => {
  // Durable, not tab-scoped: signing in again on every visit buys nothing once
  // "Disconnect" actually revokes — see `revokeToken`.
  it('keeps the token where a later visit will find it', () => {
    tokenStore.write('abc123')

    expect(localStorage.getItem('getclip.token')).toBe('abc123')
    expect(sessionStorage.getItem('getclip.token')).toBeNull()
  })

  it('reads back what it kept', () => {
    tokenStore.write('abc123')

    expect(tokenStore.read()).toBe('abc123')
  })

  it('erases it from durable storage, leaving nothing for the next visitor', () => {
    tokenStore.write('abc123')
    tokenStore.clear()

    expect(tokenStore.read()).toBeNull()
    expect(localStorage.getItem('getclip.token')).toBeNull()
  })
})
