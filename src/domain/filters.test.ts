import { describe, expect, it } from 'vitest'

import {
  applyFilters,
  dateExtent,
  facets,
  namedFirst,
  panelOrder,
  narrowedRange,
  NO_FILTERS,
  parseThreshold,
  type Facet,
} from './filters'
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
// and the search returns windows in the order they finish.
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

/**
 * The free-text search, which bites on the title and on nothing else.
 *
 * The creators and the games have their own facets, where a list of real values
 * is worth more than a guess at a substring; the title is the one field nothing
 * else reaches, and the one a reader remembers a clip by.
 */
describe('applyFilters, the query', () => {
  const titled = (title: string, over: Partial<Clip> = {}) => clip({ id: title, title, ...over })

  it('keeps everything while nothing is typed', () => {
    const found = [titled('un'), titled('deux')]

    expect(applyFilters(found, { ...NO_FILTERS, query: '' })).toHaveLength(2)
  })

  it('keeps the clips whose title contains what was typed', () => {
    const found = [titled('le boss tombe enfin'), titled('rien à signaler')]

    expect(applyFilters(found, { ...NO_FILTERS, query: 'boss' })).toHaveLength(1)
  })

  it('ignores the case', () => {
    expect(applyFilters([titled('Le BOSS')], { ...NO_FILTERS, query: 'boss' })).toHaveLength(1)
  })

  // Both ways: a title typed without accents must find an accented clip, and a
  // reader who does type them must not be punished for it.
  it('ignores the accents, in both directions', () => {
    expect(
      applyFilters([titled('la dernière fois')], { ...NO_FILTERS, query: 'derniere' }),
    ).toHaveLength(1)
    expect(
      applyFilters([titled('la derniere fois')], { ...NO_FILTERS, query: 'dernière' }),
    ).toHaveLength(1)
  })

  it('ignores the spaces around it', () => {
    expect(applyFilters([titled('le boss')], { ...NO_FILTERS, query: '  boss  ' })).toHaveLength(1)
  })

  // The creator and the game have facets of their own, where a list of real
  // values beats a guess at a substring.
  it('bites on the title alone', () => {
    const found = [titled('rien', { creator_name: 'lulubz', game_id: '512' })]

    expect(applyFilters(found, { ...NO_FILTERS, query: 'lulubz' })).toHaveLength(0)
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

// A search now opens the range on the period it covers, so both bounds are set
// as soon as it starts — without hiding a single clip. What is named as the
// reason for an empty table, and what gets offered for reopening, must be the
// bounds that actually restrict.
describe('narrowedRange', () => {
  const extent = { first: '2020-01-01', last: '2020-12-31' }

  it('narrows nothing when no bound is set', () => {
    expect(narrowedRange({ from: null, to: null }, extent)).toEqual({ from: null, to: null })
  })

  it('drops a lower bound that reaches back before the oldest clip', () => {
    expect(narrowedRange({ from: '2019-06-01', to: null }, extent).from).toBeNull()
  })

  it('drops a lower bound that falls exactly on the oldest clip', () => {
    expect(narrowedRange({ from: '2020-01-01', to: null }, extent).from).toBeNull()
  })

  it('drops an upper bound that reaches past the newest clip', () => {
    expect(narrowedRange({ from: null, to: '2021-06-01' }, extent).to).toBeNull()
  })

  it('drops an upper bound that falls exactly on the newest clip', () => {
    expect(narrowedRange({ from: null, to: '2020-12-31' }, extent).to).toBeNull()
  })

  it('keeps the bounds that do hide clips', () => {
    expect(narrowedRange({ from: '2020-03-01', to: '2020-09-30' }, extent)).toEqual({
      from: '2020-03-01',
      to: '2020-09-30',
    })
  })

  it('judges each bound on its own', () => {
    expect(narrowedRange({ from: '2020-03-01', to: '2020-12-31' }, extent)).toEqual({
      from: '2020-03-01',
      to: null,
    })
  })

  // With nothing collected there is nothing to judge against — and nothing to
  // hide either: the callers settle that case before reaching here.
  it('takes the range as it stands with no clip to judge against', () => {
    expect(narrowedRange({ from: '2020-03-01', to: null }, null)).toEqual({
      from: '2020-03-01',
      to: null,
    })
  })
})

describe('facets', () => {
  it('counts occurrences, the most numerous first', () => {
    expect(facets(clips, clips, (c) => c.creator_name)).toEqual([
      { value: 'SpiZ', count: 2 },
      { value: 'Garami', count: 1 },
      { value: 'Ori', count: 1 },
    ])
  })

  it('breaks ties alphabetically', () => {
    const result = facets(clips, clips, (c) => c.creator_name)

    expect(result.slice(1).map((f) => f.value)).toEqual(['Garami', 'Ori'])
  })

  it('drops empty values rather than offering an unusable filter', () => {
    expect(facets(clips, clips, (c) => c.game_id)).toEqual([
      { value: '2', count: 2 },
      { value: '1', count: 1 },
    ])
  })

  it('returns nothing for an empty list', () => {
    expect(facets([], [], (c) => c.creator_name)).toEqual([])
  })

  // The two lists part company as soon as another filter is on: the options
  // come from everything searched, the counts from what that filter leaves.
  describe('counted against a narrower set', () => {
    const matching = clips.filter((c) => c.view_count >= 7)

    it('counts on the narrower set, not on everything searched', () => {
      expect(facets(clips, matching, (c) => c.creator_name)[0]).toEqual({
        value: 'SpiZ',
        count: 2,
      })
    })

    it('keeps a value the other filters have spent, at zero', () => {
      const result = facets(clips, matching, (c) => c.creator_name)

      expect(result.map((f) => f.value)).toContain('Ori')
      expect(result.find((f) => f.value === 'Ori')?.count).toBe(0)
    })

    // Sorted on the absolute count, a spent value would sit between two live
    // ones and the useful rows would scatter through a list hundreds long.
    it('sinks the spent values below the live ones, in one block', () => {
      expect(facets(clips, matching, (c) => c.creator_name)).toEqual([
        { value: 'SpiZ', count: 2 },
        { value: 'Garami', count: 0 },
        { value: 'Ori', count: 0 },
      ])
    })

    it('offers nothing the search never turned up', () => {
      const result = facets(clips, matching, (c) => c.creator_name)

      expect(result.map((f) => f.value)).not.toContain('Nobody')
    })
  })
})

describe('namedFirst', () => {
  const all = [
    { value: '1', count: 9 },
    { value: '305984745', count: 7 },
    { value: '2', count: 5 },
    { value: '460630', count: 3 },
  ]
  const named = new Set(['1', '2'])
  const values = (list: Facet[]) => list.map((facet) => facet.value)

  it('sends the values it could not name to the end of the list', () => {
    expect(values(namedFirst(all, (value) => named.has(value)))).toEqual([
      '1',
      '2',
      '305984745',
      '460630',
    ])
  })

  it('leaves the order within each group alone, counts included', () => {
    const result = namedFirst(all, (value) => named.has(value))

    expect(result.slice(0, 2)).toEqual([
      { value: '1', count: 9 },
      { value: '2', count: 5 },
    ])
  })

  it('changes nothing when every value has a name', () => {
    expect(namedFirst(all, () => true)).toEqual(all)
  })

  it('changes nothing when none of them has one', () => {
    expect(namedFirst(all, () => false)).toEqual(all)
  })
})

describe('panelOrder', () => {
  const named = (value: string) => value.startsWith('named')
  const order = (list: Facet[]) => panelOrder(list, named).map((facet) => facet.value)

  // The two rules meet here, and the wrong one winning is visible at a glance:
  // an unresolved id with clips behind it must not be pushed under a named
  // category the current filters have emptied.
  it('sinks the spent facets below every live one, named or not', () => {
    const list = [
      { value: 'named-live', count: 45 },
      { value: 'named-spent', count: 0 },
      { value: 'raw-live', count: 12 },
      { value: 'raw-spent', count: 0 },
    ]

    expect(order(list)).toEqual(['named-live', 'raw-live', 'named-spent', 'raw-spent'])
  })

  it('keeps the unnamed at the tail of the block they belong to', () => {
    const list = [
      { value: 'raw-a', count: 9 },
      { value: 'named-b', count: 3 },
      { value: 'raw-c', count: 0 },
      { value: 'named-d', count: 0 },
    ]

    expect(order(list)).toEqual(['named-b', 'raw-a', 'named-d', 'raw-c'])
  })

  it('leaves a list with nothing spent to namedFirst alone', () => {
    const list = [
      { value: 'raw-a', count: 9 },
      { value: 'named-b', count: 3 },
    ]

    expect(order(list)).toEqual(['named-b', 'raw-a'])
  })
})

// The two views fields hold raw text, and two readers depend on it: the filter
// that applies the threshold, and the chip that reads it back. One parser.
describe('parseThreshold', () => {
  it('reads the number typed', () => {
    expect(parseThreshold('500')).toBe(500)
  })

  it('reads an empty field as no threshold at all', () => {
    expect(parseThreshold('')).toBeNull()
    expect(parseThreshold('   ')).toBeNull()
  })

  it('reads what is not a number as no threshold, rather than as zero', () => {
    expect(parseThreshold('abc')).toBeNull()
  })
})
