import { describe, expect, it } from 'vitest'

import { describeSelection, gameLabeller } from './selectionLabel'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

const label = (value: string) => (value === '1' ? 'Cult of the Lamb' : value)

describe('describeSelection', () => {
  // A chip with nothing checked is the filter switched off, not a filter whose
  // value happens to be "all": it stays a bare word.
  it('says nothing while nothing is checked', () => {
    expect(describeSelection([], label, t)).toBeNull()
  })

  it('names the single value rather than counting it', () => {
    expect(describeSelection(['SpiZ'], label, t)).toBe('SpiZ')
  })

  it('maps the single value through the label provided', () => {
    expect(describeSelection(['1'], label, t)).toBe('Cult of the Lamb')
  })

  it('counts beyond one value, rather than overflowing', () => {
    expect(describeSelection(['SpiZ', 'Ori'], label, t)).toBe('2 sélectionnés')
    expect(describeSelection(['a', 'b', 'c'], label, t)).toBe('3 sélectionnés')
  })
})

describe('gameLabeller', () => {
  const names = new Map([['1', 'Cult of the Lamb']])

  it('names the game whose id Helix resolved', () => {
    expect(gameLabeller(names, t)('1')).toBe('Cult of the Lamb')
  })

  // A bare "305984745" in the list reads as a bug in the tool rather than as a
  // category Twitch has stopped naming. Short enough to survive the ellipsis of
  // a 149px column, or the id it exists to carry would be the part cut off.
  it('says an unresolved id has no name, rather than showing the number alone', () => {
    expect(gameLabeller(names, t)('305984745')).toBe('Sans nom (305984745)')
  })

  it('keeps the id in reach, the count beside it being the only other clue', () => {
    expect(gameLabeller(new Map(), t)('42')).toContain('42')
  })
})
