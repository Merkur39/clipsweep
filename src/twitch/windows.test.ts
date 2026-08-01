import { describe, expect, it } from 'vitest'

import { bisect, splitByYear, windowDurationMs } from './windows'

const iso = (s: string) => new Date(s)

describe('splitByYear', () => {
  // Amorçage de la fouille : les frontières d'année coupent les niveaux hauts
  // de l'arbre de bissection, les plus coûteux, sans rien demander à personne.
  it('coupe sur les frontières d’année civile', () => {
    const windows = splitByYear(iso('2019-06-15T00:00:00Z'), iso('2021-03-10T00:00:00Z'))

    expect(windows).toEqual([
      { startedAt: '2019-06-15T00:00:00Z', endedAt: '2020-01-01T00:00:00Z' },
      { startedAt: '2020-01-01T00:00:00Z', endedAt: '2021-01-01T00:00:00Z' },
      { startedAt: '2021-01-01T00:00:00Z', endedAt: '2021-03-10T00:00:00Z' },
    ])
  })

  it('rend une seule fenêtre pour une plage tenant dans une année', () => {
    expect(splitByYear(iso('2019-06-15T00:00:00Z'), iso('2019-08-01T00:00:00Z'))).toEqual([
      { startedAt: '2019-06-15T00:00:00Z', endedAt: '2019-08-01T00:00:00Z' },
    ])
  })

  it('n’ajoute pas de fenêtre vide quand la fin tombe pile sur un 1er janvier', () => {
    const windows = splitByYear(iso('2019-06-15T00:00:00Z'), iso('2021-01-01T00:00:00Z'))

    expect(windows).toHaveLength(2)
    expect(windows[1].endedAt).toBe('2021-01-01T00:00:00Z')
  })

  it('ne rend rien pour une plage vide ou inversée', () => {
    expect(splitByYear(iso('2020-01-01T00:00:00Z'), iso('2020-01-01T00:00:00Z'))).toEqual([])
    expect(splitByYear(iso('2021-01-01T00:00:00Z'), iso('2020-01-01T00:00:00Z'))).toEqual([])
  })
})

describe('bisect', () => {
  it('cuts a window in two contiguous halves', () => {
    const halves = bisect(
      { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-03T00:00:00Z' },
      3_600_000,
    )

    expect(halves).toEqual([
      { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-02T00:00:00Z' },
      { startedAt: '2024-01-02T00:00:00Z', endedAt: '2024-01-03T00:00:00Z' },
    ])
  })

  it('refuses to cut below twice the minimum window size', () => {
    const oneHour = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-01T01:00:00Z' }

    expect(bisect(oneHour, 3_600_000)).toBeNull()
  })
})

describe('windowDurationMs', () => {
  it('measures the window span in milliseconds', () => {
    expect(
      windowDurationMs({ startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-01T06:00:00Z' }),
    ).toBe(21_600_000)
  })
})
