import { describe, expect, it } from 'vitest'

import { DEFAULT_SORT, nextSort, sortClips } from './sort'
import type { Clip } from '../twitch/types'

const clip = (over: Partial<Clip> & { id: string }): Clip => ({
  url: '',
  embed_url: '',
  broadcaster_name: 'KaliYami',
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
  it('trie une nouvelle colonne en croissant', () => {
    expect(nextSort({ key: 'views', direction: 'desc' }, 'title')).toEqual({
      key: 'title',
      direction: 'asc',
    })
  })

  it('inverse le sens sur la colonne déjà triée', () => {
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
  it('classe du moins vu au plus vu par défaut', () => {
    const clips = [clip({ id: 'a', view_count: 9 }), clip({ id: 'b', view_count: 0 })]

    expect(ids(sortClips(clips, DEFAULT_SORT))).toEqual(['b', 'a'])
  })

  it('inverse les vues en décroissant', () => {
    const clips = [clip({ id: 'a', view_count: 9 }), clip({ id: 'b', view_count: 0 })]

    expect(ids(sortClips(clips, { key: 'views', direction: 'desc' }))).toEqual(['a', 'b'])
  })

  it('classe par date, les chaînes ISO se comparant telles quelles', () => {
    const clips = [
      clip({ id: 'recent', created_at: '2026-03-01T00:00:00Z' }),
      clip({ id: 'ancien', created_at: '2026-01-01T00:00:00Z' }),
    ]

    expect(ids(sortClips(clips, { key: 'date', direction: 'asc' }))).toEqual(['ancien', 'recent'])
  })

  it('classe les titres sans se laisser piéger par les accents', () => {
    const clips = [
      clip({ id: 'z', title: 'Zoé' }),
      clip({ id: 'e', title: 'Élodie' }),
      clip({ id: 'a', title: 'Alice' }),
    ]

    expect(ids(sortClips(clips, { key: 'title', direction: 'asc' }))).toEqual(['a', 'e', 'z'])
  })

  it('ignore la casse sur les créateurs', () => {
    const clips = [clip({ id: 'b', creator_name: 'ori' }), clip({ id: 'a', creator_name: 'Alice' })]

    expect(ids(sortClips(clips, { key: 'creator', direction: 'asc' }))).toEqual(['a', 'b'])
  })

  it('ordonne les nombres dans les titres comme des nombres', () => {
    const clips = [clip({ id: 'dix', title: 'Clip 10' }), clip({ id: 'deux', title: 'Clip 2' })]

    expect(ids(sortClips(clips, { key: 'title', direction: 'asc' }))).toEqual(['deux', 'dix'])
  })

  // Des milliers de clips partagent view_count à 0 : sans clé secondaire, leur
  // ordre relatif changerait d'un rendu à l'autre.
  it('départage les ex æquo par id, dans les deux sens', () => {
    const clips = [
      clip({ id: 'c', view_count: 0 }),
      clip({ id: 'a', view_count: 0 }),
      clip({ id: 'b', view_count: 0 }),
    ]

    expect(ids(sortClips(clips, { key: 'views', direction: 'asc' }))).toEqual(['a', 'b', 'c'])
    expect(ids(sortClips(clips, { key: 'views', direction: 'desc' }))).toEqual(['a', 'b', 'c'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const clips = [clip({ id: 'a', view_count: 9 }), clip({ id: 'b', view_count: 0 })]

    sortClips(clips, DEFAULT_SORT)

    expect(ids(clips)).toEqual(['a', 'b'])
  })

  it('accepte un titre vide sans le faire disparaître', () => {
    const clips = [clip({ id: 'vide', title: '' }), clip({ id: 'plein', title: 'Alice' })]

    expect(ids(sortClips(clips, { key: 'title', direction: 'asc' }))).toEqual(['vide', 'plein'])
  })
})
