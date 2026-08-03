import { describe, expect, it } from 'vitest'

import { makeT, render } from './translate'

describe('render', () => {
  it('rend une chaîne simple telle quelle', () => {
    expect(render('Déconnecté de Twitch.', 'fr')).toBe('Déconnecté de Twitch.')
  })

  it('substitue les paramètres nommés', () => {
    expect(render('Chaîne « {login} » introuvable.', 'fr', { login: 'zerator' })).toBe(
      'Chaîne « zerator » introuvable.',
    )
  })

  it('substitue plusieurs fois le même paramètre', () => {
    expect(render('{a} → {a}', 'fr', { a: 'x' })).toBe('x → x')
  })

  // Un paramètre manquant laisse sa marque plutôt que d'écrire « undefined » :
  // le trou se voit à la relecture comme au test de parité.
  it('laisse le trou visible quand le paramètre manque', () => {
    expect(render('{a} et {b}', 'fr', { a: 'x' })).toBe('x et {b}')
  })

  // Les nombres destinés à être lus sont groupés — c'est la règle par défaut,
  // puisque la quasi-totalité des nombres interpolés sont des décomptes.
  it('groupe les nombres interpolés selon la langue', () => {
    expect(render('{n} clips', 'fr', { n: 1234 })).toBe(`1${String.fromCharCode(0x00a0)}234 clips`)
    expect(render('{n} clips', 'en', { n: 1234 })).toBe('1,234 clips')
  })

  // L'échappatoire : un identifiant, une année ou un code HTTP se passe en
  // chaîne, et traverse sans séparateur de milliers.
  it('laisse intacte une valeur déjà en chaîne', () => {
    expect(render('Twitch répond {status}', 'fr', { status: '404' })).toBe('Twitch répond 404')
  })

  // Les dates suivent la même logique que les nombres : l'appelant déclare une
  // intention, le moteur connaît la langue. La couche domaine n'a donc jamais
  // besoin de la langue servie pour composer une phrase datée.
  it('rend un jour dans l’ordre de la langue', () => {
    expect(render('depuis le {d}', 'fr', { d: { day: '2026-08-03' } })).toBe('depuis le 03/08/2026')
    expect(render('since {d}', 'en', { d: { day: '2026-08-03T22:41:07Z' } })).toBe(
      'since 08/03/2026',
    )
  })

  describe('pluriel', () => {
    const clips = { one: '{n} clip récupéré', other: '{n} clips récupérés' }

    it('choisit la forme sur `n`', () => {
      expect(render(clips, 'fr', { n: 1 })).toBe('1 clip récupéré')
      expect(render(clips, 'fr', { n: 2 })).toBe('2 clips récupérés')
      expect(render(clips, 'fr', { n: 0 })).toBe('0 clip récupéré')
    })

    /**
     * Le zéro sépare les deux langues, et c'est tout l'intérêt de déléguer à
     * `Intl.PluralRules` : le français accorde « 0 clip » au singulier, l'anglais
     * dit « 0 clips ». Une règle `n > 1` écrite à la main se tromperait ici.
     */
    it('suit la règle de la langue sur le zéro', () => {
      const found = { one: '{n} clip found', other: '{n} clips found' }

      expect(render(found, 'en', { n: 0 })).toBe('0 clips found')
      expect(render(found, 'en', { n: 1 })).toBe('1 clip found')
    })
  })
})

describe('makeT', () => {
  it('sert le catalogue de la langue demandée', () => {
    expect(makeT('fr')('access.disconnected')).toBe('Déconnecté de Twitch.')
    expect(makeT('en')('access.disconnected')).not.toBe(makeT('fr')('access.disconnected'))
  })

  it('accorde selon la langue servie', () => {
    expect(makeT('fr')('results.count.found', { n: 1 })).toBe('1 clip récupéré')
    expect(makeT('fr')('results.count.found', { n: 2 })).toBe('2 clips récupérés')
    expect(makeT('en')('results.count.found', { n: 1 })).toBe('1 clip collected')
  })
})
