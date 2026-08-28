import { describe, expect, it } from 'vitest'

import { COLUMNS, SORT_COLUMNS } from './sortColumns'
import { SORT_KEYS } from '../domain/sort'

describe('the readout columns', () => {
  // A key the domain can order on and no head offers is a key nothing can
  // reach: the ordering exists, and there is no way to ask for it.
  it('heads every key the domain can order on', () => {
    expect(SORT_COLUMNS.map((column) => column.key).sort()).toEqual([...SORT_KEYS].sort())
  })

  // The game: the chip groups better than an order could, and ordering on it
  // would cost the domain a resolver for a name Helix does not serve.
  it('draws a column the list does not order on', () => {
    expect(COLUMNS.filter((column) => column.key === undefined).map((c) => c.className)).toEqual([
      'col-game',
    ])
  })

  it('gives each column its own track', () => {
    const classes = COLUMNS.map((column) => column.className)

    expect(new Set(classes).size).toBe(classes.length)
  })
})
