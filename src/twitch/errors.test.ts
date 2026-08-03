import { describe, expect, it } from 'vitest'

import { describeError, TranslatableError } from './errors'
import { TokenRejectedError } from './api'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

describe('describeError', () => {
  it('rend une erreur connue dans la langue servie', () => {
    const error = new TranslatableError('error.channelNotFound', { login: 'zerator' })

    expect(describeError(error, t)).toBe('Chaîne « zerator » introuvable.')
    expect(describeError(error, makeT('en'))).toBe('Channel “zerator” not found.')
  })

  it('couvre le rejet du jeton, qui en est un cas', () => {
    expect(describeError(new TokenRejectedError(), t)).toBe(
      'Jeton refusé par Twitch. Reconnecte-toi.',
    )
  })

  /**
   * Le `message` que Twitch renvoie dans sa charge utile, comme une panne
   * réseau formulée par le navigateur, est un texte libre : le traduire
   * supposerait de le reconnaître, ce qui n'est pas faisable.
   */
  it('reprend telle quelle une erreur venue d’ailleurs', () => {
    expect(describeError(new Error('Malformed query params.'), t)).toBe('Malformed query params.')
  })

  // Une trace de console ne doit pas être vide sous prétexte que le texte vit
  // ailleurs : la clé y tient lieu de message.
  it('garde la clé comme message brut', () => {
    expect(new TranslatableError('error.tokenInvalid').message).toBe('error.tokenInvalid')
  })
})
