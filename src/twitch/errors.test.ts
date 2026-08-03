import { describe, expect, it } from 'vitest'

import { describeError, TranslatableError } from './errors'
import { TokenRejectedError } from './api'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

describe('describeError', () => {
  it('renders a known error in the language served', () => {
    const error = new TranslatableError('error.channelNotFound', { login: 'zerator' })

    expect(describeError(error, t)).toBe('Chaîne « zerator » introuvable.')
    expect(describeError(error, makeT('en'))).toBe('Channel “zerator” not found.')
  })

  it('covers the token rejection, which is one of them', () => {
    expect(describeError(new TokenRejectedError(), t)).toBe(
      'Jeton refusé par Twitch. Reconnecte-toi.',
    )
  })

  /**
   * The `message` Twitch returns in its payload, like a network failure phrased
   * by the browser, is free text: translating it would require recognizing it,
   * which is not feasible.
   */
  it('passes through an error that came from elsewhere', () => {
    expect(describeError(new Error('Malformed query params.'), t)).toBe('Malformed query params.')
  })

  // A console trace must not be empty on the grounds that the text lives
  // elsewhere: the key stands in for the message there.
  it('keeps the key as the raw message', () => {
    expect(new TranslatableError('error.tokenInvalid').message).toBe('error.tokenInvalid')
  })
})
