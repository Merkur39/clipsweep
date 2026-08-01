import { describe, expect, it } from 'vitest'

import { describeEmptyResults } from './results'

describe('describeEmptyResults', () => {
  it('invite à lancer une fouille tant que rien n’a tourné', () => {
    expect(describeEmptyResults({ searched: false, clipsFound: 0, maxViews: null })).toBe(
      'Aucune fouille lancée.',
    )
  })

  it('distingue une période sans aucun clip', () => {
    expect(describeEmptyResults({ searched: true, clipsFound: 0, maxViews: 2 })).toBe(
      'Aucun clip sur cette période. Élargis l’intervalle de dates.',
    )
  })

  it('dit combien de clips le filtre masque, et comment les voir', () => {
    const message = describeEmptyResults({ searched: true, clipsFound: 6, maxViews: 2 })

    expect(message).toContain('6 clips')
    expect(message).toContain('2 vues')
    expect(message).toContain('Vues max')
  })

  it('accorde le singulier', () => {
    expect(describeEmptyResults({ searched: true, clipsFound: 1, maxViews: 0 })).toContain(
      '1 clip ',
    )
    expect(describeEmptyResults({ searched: true, clipsFound: 1, maxViews: 1 })).toContain('1 vue')
  })

  it('ne parle pas de seuil quand le filtre est vide', () => {
    const message = describeEmptyResults({ searched: true, clipsFound: 6, maxViews: null })

    expect(message).not.toContain('Vues max')
  })
})
