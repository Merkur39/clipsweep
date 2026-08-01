import { describe, expect, it } from 'vitest'

import { describeSelection } from './selectionLabel'

const nom = (value: string) => (value === '1' ? 'Cult of the Lamb' : value)

describe('describeSelection', () => {
  it('annonce « Tous » quand rien n’est coché', () => {
    expect(describeSelection([], nom)).toBe('Tous')
  })

  it('nomme la valeur unique plutôt que de la compter', () => {
    expect(describeSelection(['SpiZ'], nom)).toBe('SpiZ')
  })

  it('traduit la valeur unique via le libellé fourni', () => {
    expect(describeSelection(['1'], nom)).toBe('Cult of the Lamb')
  })

  it('compte au-delà d’une valeur, plutôt que de déborder', () => {
    expect(describeSelection(['SpiZ', 'Ori'], nom)).toBe('2 sélectionnés')
    expect(describeSelection(['a', 'b', 'c'], nom)).toBe('3 sélectionnés')
  })
})
