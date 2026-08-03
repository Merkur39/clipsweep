import { describe, expect, it } from 'vitest'

import { describeSelection } from './selectionLabel'
import { makeT } from '../i18n/translate'

const t = makeT('fr')

const label = (value: string) => (value === '1' ? 'Cult of the Lamb' : value)

describe('describeSelection', () => {
  it('announces "All" when nothing is checked', () => {
    expect(describeSelection([], label, t)).toBe('Tous')
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
