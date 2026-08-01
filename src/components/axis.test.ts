import { describe, expect, it } from 'vitest'

import { axisTicks } from './axis'

const t = (iso: string) => Date.parse(iso)

describe('axisTicks', () => {
  it('pose un repère sur chaque 1er janvier de la période', () => {
    const ticks = axisTicks(t('2019-03-01T00:00:00Z'), t('2022-09-01T00:00:00Z'))

    expect(ticks.map((tick) => tick.label)).toEqual(['2020', '2021', '2022'])
  })

  // L'ancien pas plafonnait à huit repères et sautait donc une année sur deux
  // dès neuf ans : les colonnes de bord se retrouvaient sans date en dessous,
  // ce qui les faisait passer pour tronquées alors qu'elles sont partielles.
  it('n’éclaircit pas ce qui tient : neuf ans gardent leurs neuf repères', () => {
    const ticks = axisTicks(t('2018-07-10T00:00:00Z'), t('2026-08-01T23:59:59Z'))

    expect(ticks.map((tick) => tick.label)).toEqual([
      '2019',
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
    ])
  })

  it('éclaircit au-delà de ce que la largeur peut porter', () => {
    const ticks = axisTicks(t('1990-01-01T00:00:00Z'), t('2026-01-01T00:00:00Z'))

    expect(ticks.length).toBeLessThanOrEqual(12)
  })

  // Un 1er janvier hors période n'a pas de place sur l'axe.
  it('écarte les 1ers janvier hors de la période', () => {
    const ticks = axisTicks(t('2019-03-01T00:00:00Z'), t('2019-11-01T00:00:00Z'))

    expect(ticks).toEqual([])
  })

  it('ne rend rien d’une période vide', () => {
    expect(axisTicks(t('2026-01-01T00:00:00Z'), t('2026-01-01T00:00:00Z'))).toEqual([])
  })
})
