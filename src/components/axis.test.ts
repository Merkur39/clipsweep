import { describe, expect, it } from 'vitest'

import { axisTicks } from './axis'

const t = (iso: string) => Date.parse(iso)

describe('axisTicks', () => {
  it('puts a tick on every 1 January of the period', () => {
    const ticks = axisTicks(t('2019-03-01T00:00:00Z'), t('2022-09-01T00:00:00Z'))

    expect(ticks.map((tick) => tick.label)).toEqual(['2020', '2021', '2022'])
  })

  // The old step capped at eight ticks and therefore skipped every other year
  // from nine years onwards: the edge columns ended up with no date beneath
  // them, which made them look truncated when they are merely partial.
  it('does not thin what fits: nine years keep their nine ticks', () => {
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

  it('thins beyond what the width can carry', () => {
    const ticks = axisTicks(t('1990-01-01T00:00:00Z'), t('2026-01-01T00:00:00Z'))

    expect(ticks.length).toBeLessThanOrEqual(12)
  })

  // A 1 January outside the period has no place on the axis.
  it('drops the 1 Januaries outside the period', () => {
    const ticks = axisTicks(t('2019-03-01T00:00:00Z'), t('2019-11-01T00:00:00Z'))

    expect(ticks).toEqual([])
  })

  it('returns nothing for an empty period', () => {
    expect(axisTicks(t('2026-01-01T00:00:00Z'), t('2026-01-01T00:00:00Z'))).toEqual([])
  })
})
