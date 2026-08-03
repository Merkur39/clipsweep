import { describe, expect, it } from 'vitest'

import { DEFAULT_SORT, nextSort, sortClips } from './sort'
import type { Clip } from '../twitch/types'

const clip = (over: Partial<Clip> & { id: string }): Clip => ({
  url: '',
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

const ids = (clips: Clip[]) => clips.map((c) => c.id)

describe('nextSort', () => {
  it('sorts a new column ascending', () => {
    expect(nextSort({ key: 'views', direction: 'desc' }, 'title')).toEqual({
      key: 'title',
      direction: 'asc',
    })
  })

  it('flips the direction on the already sorted column', () => {
    expect(nextSort({ key: 'views', direction: 'asc' }, 'views')).toEqual({
      key: 'views',
      direction: 'desc',
    })
    expect(nextSort({ key: 'views', direction: 'desc' }, 'views')).toEqual({
      key: 'views',
      direction: 'asc',
    })
  })
})

describe('sortClips', () => {
  it('orders from least to most viewed by default', () => {
    const clips = [clip({ id: 'a', view_count: 9 }), clip({ id: 'b', view_count: 0 })]

    expect(ids(sortClips(clips, DEFAULT_SORT))).toEqual(['b', 'a'])
  })

  it('reverses views when descending', () => {
    const clips = [clip({ id: 'a', view_count: 9 }), clip({ id: 'b', view_count: 0 })]

    expect(ids(sortClips(clips, { key: 'views', direction: 'desc' }))).toEqual(['a', 'b'])
  })

  it('orders by date, ISO strings comparing as they are', () => {
    const clips = [
      clip({ id: 'recent', created_at: '2026-03-01T00:00:00Z' }),
      clip({ id: 'older', created_at: '2026-01-01T00:00:00Z' }),
    ]

    expect(ids(sortClips(clips, { key: 'date', direction: 'asc' }))).toEqual(['older', 'recent'])
  })

  it('orders titles without being tripped up by accents', () => {
    const clips = [
      clip({ id: 'z', title: 'Zoé' }),
      clip({ id: 'e', title: 'Élodie' }),
      clip({ id: 'a', title: 'Alice' }),
    ]

    expect(ids(sortClips(clips, { key: 'title', direction: 'asc' }))).toEqual(['a', 'e', 'z'])
  })

  it('ignores case on creators', () => {
    const clips = [clip({ id: 'b', creator_name: 'ori' }), clip({ id: 'a', creator_name: 'Alice' })]

    expect(ids(sortClips(clips, { key: 'creator', direction: 'asc' }))).toEqual(['a', 'b'])
  })

  it('orders numbers inside titles as numbers', () => {
    const clips = [clip({ id: 'ten', title: 'Clip 10' }), clip({ id: 'two', title: 'Clip 2' })]

    expect(ids(sortClips(clips, { key: 'title', direction: 'asc' }))).toEqual(['two', 'ten'])
  })

  // Thousands of clips share a view_count of 0: without a secondary key, their
  // relative order would change from one render to the next.
  it('breaks ties by id, in both directions', () => {
    const clips = [
      clip({ id: 'c', view_count: 0 }),
      clip({ id: 'a', view_count: 0 }),
      clip({ id: 'b', view_count: 0 }),
    ]

    expect(ids(sortClips(clips, { key: 'views', direction: 'asc' }))).toEqual(['a', 'b', 'c'])
    expect(ids(sortClips(clips, { key: 'views', direction: 'desc' }))).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the array it receives', () => {
    const clips = [clip({ id: 'a', view_count: 9 }), clip({ id: 'b', view_count: 0 })]

    sortClips(clips, DEFAULT_SORT)

    expect(ids(clips)).toEqual(['a', 'b'])
  })

  it('accepts an empty title without making it disappear', () => {
    const clips = [clip({ id: 'empty', title: '' }), clip({ id: 'filled', title: 'Alice' })]

    expect(ids(sortClips(clips, { key: 'title', direction: 'asc' }))).toEqual(['empty', 'filled'])
  })
})
