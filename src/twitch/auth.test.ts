import { describe, expect, it } from 'vitest'

import { authorizeUrl, normalizeRedirectUri, parseAuthFragment } from './auth'

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
    expect(parseAuthFragment('#error=access_denied')).toEqual({ status: 'error', message: 'access_denied' })
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
    expect(normalizeRedirectUri('https://merkur39.github.io', '/get-clip-twitch/')).toBe(
      'https://merkur39.github.io/get-clip-twitch/',
    )
  })

  it('adds the trailing slash when the subpath is reached without one', () => {
    expect(normalizeRedirectUri('https://merkur39.github.io', '/get-clip-twitch')).toBe(
      'https://merkur39.github.io/get-clip-twitch/',
    )
  })

  it('drops an explicit html filename', () => {
    expect(normalizeRedirectUri('https://merkur39.github.io', '/get-clip-twitch/index.html')).toBe(
      'https://merkur39.github.io/get-clip-twitch/',
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
