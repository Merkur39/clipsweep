import { describe, expect, it } from 'vitest'

import { applyFilters, dateExtent, facets, NO_FILTERS } from './filters'
import type { Clip } from '../twitch/types'

const clip = (over: Partial<Clip> & { id: string }): Clip => ({
  url: `https://www.twitch.tv/testchannel/clip/${over.id}`,
  embed_url: '',
  broadcaster_name: 'TestChannel',
  creator_name: 'SpiZ',
  title: over.id,
  view_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  thumbnail_url: '',
  duration: 30,
  game_id: '1',
  ...over,
})

const clips = [
  clip({ id: 'a', view_count: 9, creator_name: 'SpiZ', game_id: '1' }),
  clip({ id: 'b', view_count: 4, creator_name: 'Ori', game_id: '2' }),
  clip({ id: 'c', view_count: 7, creator_name: 'SpiZ', game_id: '2' }),
  clip({ id: 'd', view_count: 0, creator_name: 'Garami', game_id: '' }),
]

// Dates deliberately out of order: nothing in the domain assumes a sorted array,
// and the sweep returns windows in the order they finish.
const dated = [
  clip({ id: 'w', created_at: '2020-06-30T23:30:00Z' }),
  clip({ id: 'x', created_at: '2019-03-04T08:00:00Z' }),
  clip({ id: 'y', created_at: '2021-12-25T12:00:00Z' }),
  clip({ id: 'z', created_at: '2020-01-01T00:00:00Z' }),
]

const ids = (result: Clip[]) => result.map((c) => c.id)

describe('applyFilters', () => {
  // Ordering belongs to sortClips: applyFilters preserves the one it receives.
  it('returns everything, in the order received, with no filter', () => {
    expect(ids(applyFilters(clips, NO_FILTERS))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('applies a view floor, bound included', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, minViews: 7 }))).toEqual(['a', 'c'])
  })

  it('applies a view ceiling, bound included', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, maxViews: 4 }))).toEqual(['b', 'd'])
  })

  it('combines floor and ceiling into a range', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, minViews: 4, maxViews: 7 }))).toEqual([
      'b',
      'c',
    ])
  })

  it('returns nothing when the range is inverted', () => {
    expect(applyFilters(clips, { ...NO_FILTERS, minViews: 8, maxViews: 2 })).toEqual([])
  })

  it('filters by creator', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ'] }))).toEqual(['a', 'c'])
  })

  it('filters by game', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, gameIds: ['2'] }))).toEqual(['b', 'c'])
  })

  // Within one facet the values add up, between facets they narrow: "SpiZ or
  // Ori", but "and on game 2".
  it('unions the values of a single facet', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ', 'Ori'] }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('intersects two different facets', () => {
    const result = applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ', 'Ori'], gameIds: ['2'] })

    expect(ids(result)).toEqual(['b', 'c'])
  })

  it('treats an empty list as no filter at all', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, creators: [], gameIds: [] }))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('stacks filters of different kinds', () => {
    const result = applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ'], maxViews: 8 })

    expect(ids(result)).toEqual(['c'])
  })

  it('does not mutate the array it receives', () => {
    applyFilters(clips, NO_FILTERS)

    expect(ids(clips)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('applies a range start, bound included', () => {
    expect(ids(applyFilters(dated, { ...NO_FILTERS, from: '2020-01-01' }))).toEqual(['w', 'y', 'z'])
  })

  it('applies a range end, bound included', () => {
    expect(ids(applyFilters(dated, { ...NO_FILTERS, to: '2020-01-01' }))).toEqual(['x', 'z'])
  })

  it('combines start and end into a range', () => {
    const result = applyFilters(dated, { ...NO_FILTERS, from: '2020-01-01', to: '2020-06-30' })

    expect(ids(result)).toEqual(['w', 'z'])
  })

  // The Date column shows `created_at.slice(0, 10)`: the filter must keep what
  // the user reads. Comparing on the timestamp would drop this 23:30 clip even
  // though its row carries the range's end date.
  it('compares the displayed day, not the timestamp', () => {
    expect(
      ids(applyFilters(dated, { ...NO_FILTERS, from: '2020-06-30', to: '2020-06-30' })),
    ).toEqual(['w'])
  })

  it('returns nothing when the range is inverted', () => {
    expect(applyFilters(dated, { ...NO_FILTERS, from: '2021-01-01', to: '2020-01-01' })).toEqual([])
  })

  it('treats a null bound as no filter at all', () => {
    expect(ids(applyFilters(dated, { ...NO_FILTERS, from: null, to: null }))).toEqual([
      'w',
      'x',
      'y',
      'z',
    ])
  })

  it('intersects the range with another facet', () => {
    const mixed = [
      clip({ id: 'p', created_at: '2020-05-05T00:00:00Z', creator_name: 'SpiZ' }),
      clip({ id: 'q', created_at: '2020-05-06T00:00:00Z', creator_name: 'Ori' }),
      clip({ id: 'r', created_at: '2021-05-05T00:00:00Z', creator_name: 'SpiZ' }),
    ]

    const result = applyFilters(mixed, { ...NO_FILTERS, from: '2020-01-01', creators: ['SpiZ'] })

    expect(ids(result)).toEqual(['p', 'r'])
  })
})

describe('dateExtent', () => {
  it('returns nothing for an empty list', () => {
    expect(dateExtent([])).toBeNull()
  })

  it('returns the oldest and the newest, whatever order it received', () => {
    expect(dateExtent(dated)).toEqual({ first: '2019-03-04', last: '2021-12-25' })
  })

  it('returns the same date twice for a lone clip', () => {
    expect(dateExtent([clip({ id: 'a', created_at: '2020-02-29T10:00:00Z' })])).toEqual({
      first: '2020-02-29',
      last: '2020-02-29',
    })
  })
})

describe('facets', () => {
  it('counts occurrences, the most numerous first', () => {
    expect(facets(clips, (c) => c.creator_name)).toEqual([
      { value: 'SpiZ', count: 2 },
      { value: 'Garami', count: 1 },
      { value: 'Ori', count: 1 },
    ])
  })

  it('breaks ties alphabetically', () => {
    const result = facets(clips, (c) => c.creator_name)

    expect(result.slice(1).map((f) => f.value)).toEqual(['Garami', 'Ori'])
  })

  it('drops empty values rather than offering an unusable filter', () => {
    expect(facets(clips, (c) => c.game_id)).toEqual([
      { value: '2', count: 2 },
      { value: '1', count: 1 },
    ])
  })

  it('returns nothing for an empty list', () => {
    expect(facets([], (c) => c.creator_name)).toEqual([])
  })
})
