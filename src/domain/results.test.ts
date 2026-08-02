import { describe, expect, it } from 'vitest'

import { describeEmptyResults, describeResultCount, describeSearchStatus } from './results'

describe('describeSearchStatus', () => {
  it('ne dit rien tant qu’aucune fouille n’a tourné', () => {
    expect(describeSearchStatus({ running: false, progress: null, clipsFound: 0 })).toBeNull()
  })

  it('rend compte de l’avancement pendant la fouille', () => {
    const texte = describeSearchStatus({
      running: true,
      progress: { windowsDone: 12, windowsTotal: 40, clipsFound: 340, requests: 55 },
      clipsFound: 0,
    })

    expect(texte).toContain('12')
    expect(texte).toContain('40')
    expect(texte).toContain('340')
  })

  it('annonce le bilan une fois la fouille finie', () => {
    const texte = describeSearchStatus({
      running: false,
      progress: { windowsDone: 40, windowsTotal: 40, clipsFound: 412, requests: 90 },
      clipsFound: 412,
    })

    expect(texte).toContain('412')
    expect(texte).not.toContain('en cours')
  })

  it('accorde le singulier', () => {
    const texte = describeSearchStatus({
      running: false,
      progress: { windowsDone: 1, windowsTotal: 1, clipsFound: 1, requests: 1 },
      clipsFound: 1,
    })

    expect(texte).toContain('1 clip ')
    expect(texte).not.toContain('1 clips')
  })
})

describe('describeResultCount', () => {
  it('se tait tant qu’il n’y a rien à compter', () => {
    expect(describeResultCount({ found: 0, shown: 0, selected: 0 })).toBe('')
  })

  // Forme stable : les trois nombres toujours présents, plus lisibles d'un coup
  // d'œil qu'un libellé dont la structure change selon les valeurs.
  it('donne les trois nombres', () => {
    expect(describeResultCount({ found: 412, shown: 87, selected: 40 })).toBe(
      '412 clips récupérés · 87 affichés · 40 sélectionnés',
    )
  })

  it('accorde chaque nombre séparément', () => {
    expect(describeResultCount({ found: 1, shown: 1, selected: 1 })).toBe(
      '1 clip récupéré · 1 affiché · 1 sélectionné',
    )
  })

  it('gère une sélection vide', () => {
    expect(describeResultCount({ found: 5, shown: 5, selected: 0 })).toBe(
      '5 clips récupérés · 5 affichés · 0 sélectionné',
    )
  })
})

describe('describeEmptyResults', () => {
  it('invite à lancer une fouille tant que rien n’a tourné', () => {
    expect(
      describeEmptyResults({ searched: false, running: false, clipsFound: 0, maxViews: null }),
    ).toBe('Aucune fouille lancée.')
  })

  it('distingue une période sans aucun clip', () => {
    expect(
      describeEmptyResults({ searched: true, running: false, clipsFound: 0, maxViews: 2 }),
    ).toBe('Aucun clip sur cette période. Élargis l’intervalle de dates.')
  })

  // La fouille dure de quelques secondes à plusieurs minutes. Conclure « aucun
  // clip » pendant ce temps est faux : la première période n'a pas encore rendu.
  it('ne conclut pas à l’absence de clips tant que la fouille tourne', () => {
    const message = describeEmptyResults({
      searched: true,
      running: true,
      clipsFound: 0,
      maxViews: null,
    })

    expect(message).not.toContain('Aucun clip sur cette période')
    expect(message).not.toContain('Élargis')
    expect(message).toContain('cours')
  })

  // Une fois des clips récupérés, le filtre redevient l'explication valable,
  // fouille en cours ou non.
  it('explique quand même le filtre pendant la fouille', () => {
    const message = describeEmptyResults({
      searched: true,
      running: true,
      clipsFound: 6,
      maxViews: 2,
    })

    expect(message).toContain('Vues max')
  })

  it('dit combien de clips le filtre masque, et comment les voir', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 6,
      maxViews: 2,
    })

    expect(message).toContain('6 clips')
    expect(message).toContain('2 vues')
    expect(message).toContain('Vues max')
  })

  it('accorde le singulier', () => {
    expect(
      describeEmptyResults({ searched: true, running: false, clipsFound: 1, maxViews: 0 }),
    ).toContain('1 clip ')
    expect(
      describeEmptyResults({ searched: true, running: false, clipsFound: 1, maxViews: 1 }),
    ).toContain('1 vue')
  })

  it('ne parle pas de seuil quand le filtre est vide', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 6,
      maxViews: null,
    })

    expect(message).not.toContain('Vues max')
  })

  it('nomme la plage de dates qui vide la table', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 412,
      maxViews: null,
      period: { from: '2020-01-01', to: '2020-06-30' },
    })

    expect(message).toContain('412 clips')
    expect(message).toContain('entre le 2020-01-01 et le 2020-06-30')
    expect(message).toContain('Du / Au')
  })

  it('dit « à partir du » quand seule la borne de début est posée', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 6,
      maxViews: null,
      period: { from: '2021-05-05', to: null },
    })

    expect(message).toContain('à partir du 2021-05-05')
    expect(message).not.toContain('entre')
  })

  it('dit « jusqu’au » quand seule la borne de fin est posée', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 6,
      maxViews: null,
      period: { from: null, to: '2019-01-01' },
    })

    expect(message).toContain('jusqu’au 2019-01-01')
    expect(message).not.toContain('entre')
  })

  // Deux filtres actifs, une seule cause à nommer : la plage est ce que
  // l'utilisateur vient de resserrer à la main, et c'est elle que l'action de la
  // table vide propose de rouvrir.
  it('nomme la plage plutôt que le seuil quand les deux sont posés', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 6,
      maxViews: 2,
      period: { from: '2020-01-01', to: '2020-06-30' },
    })

    expect(message).toContain('2020-01-01')
    expect(message).not.toContain('Vues max')
  })

  it('se tait sur les dates quand aucune borne n’est posée', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 6,
      maxViews: null,
      period: { from: null, to: null },
    })

    expect(message).not.toContain('Du / Au')
  })

  // Le manque de clips prime sur les filtres : une plage posée sur une fouille
  // vide n'explique rien, c'est la période fouillée qu'il faut élargir.
  it('garde la priorité au cas « aucun clip récupéré »', () => {
    const message = describeEmptyResults({
      searched: true,
      running: false,
      clipsFound: 0,
      maxViews: null,
      period: { from: '2020-01-01', to: '2020-06-30' },
    })

    expect(message).toBe('Aucun clip sur cette période. Élargis l’intervalle de dates.')
  })
})
