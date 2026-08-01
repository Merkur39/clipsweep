import { describe, expect, it } from 'vitest'

import { clampSince, clampUntil, describePeriodError } from './period'

describe('describePeriodError', () => {
  it('ne dit rien d’une période valable', () => {
    expect(describePeriodError('2019-01-01', '2026-08-01')).toBeNull()
  })

  // La fouille borne la fin à 23:59:59 : un début et une fin le même jour
  // couvrent bien cette journée-là.
  it('accepte une période d’un seul jour', () => {
    expect(describePeriodError('2026-08-01', '2026-08-01')).toBeNull()
  })

  it('signale un début postérieur à la fin', () => {
    expect(describePeriodError('2026-08-02', '2026-08-01')).toBe(
      'La date de début doit précéder la date de fin.',
    )
  })
})

describe('clampUntil', () => {
  it('laisse la date intacte quand elle précède aujourd’hui', () => {
    expect(clampUntil('2026-07-01', '2026-08-01')).toBe('2026-07-01')
  })

  // Aucun clip ne peut exister dans le futur : les fenêtres au-delà d'aujourd'hui
  // ne rendraient rien, en dépensant une requête chacune.
  it('ramène la date à aujourd’hui quand elle le dépasse', () => {
    expect(clampUntil('2027-01-01', '2026-08-01')).toBe('2026-08-01')
  })

  it('accepte l’égalité sans rien changer', () => {
    expect(clampUntil('2026-08-01', '2026-08-01')).toBe('2026-08-01')
  })

  // Le temps avance : une date saisie trop loin finit par devenir légitime, à
  // condition de ne pas l'avoir écrasée entre-temps.
  it('ne détruit pas la saisie, elle redevient valable le jour venu', () => {
    const saisie = '2026-12-31'

    expect(clampUntil(saisie, '2026-08-01')).toBe('2026-08-01')
    expect(clampUntil(saisie, '2027-03-15')).toBe(saisie)
  })
})

describe('clampSince', () => {
  it('laisse la date intacte quand la chaîne lui est antérieure', () => {
    expect(clampSince('2019-01-01', '2017-07-10')).toBe('2019-01-01')
  })

  // Fouiller avant l'existence de la chaîne ne peut rien rendre, et coûte une
  // fenêtre annuelle — donc au moins une requête — par année de trop.
  it('cale la date sur la création quand elle lui est antérieure', () => {
    expect(clampSince('2015-01-01', '2017-07-10')).toBe('2017-07-10')
  })

  it('accepte l’égalité sans rien changer', () => {
    expect(clampSince('2017-07-10', '2017-07-10')).toBe('2017-07-10')
  })

  // Tant que la chaîne n'a pas été résolue, on ne contraint rien : la saisie de
  // l'utilisateur fait foi.
  it('ne contraint rien tant que la date de création est inconnue', () => {
    expect(clampSince('2015-01-01', null)).toBe('2015-01-01')
  })

  // La contrainte appartient à la chaîne visée, pas à la saisie : revenir sur
  // une chaîne plus ancienne doit rendre sa date d'origine.
  it('ne détruit pas la saisie, elle redevient valable sur une chaîne plus ancienne', () => {
    const saisie = '2015-01-01'

    expect(clampSince(saisie, '2017-07-10')).toBe('2017-07-10')
    expect(clampSince(saisie, '2011-06-06')).toBe(saisie)
  })
})
