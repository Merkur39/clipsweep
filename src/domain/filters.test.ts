import { describe, expect, it } from 'vitest'

import { applyFilters, facets, NO_FILTERS } from './filters'
import type { Clip } from '../twitch/types'

const clip = (over: Partial<Clip> & { id: string }): Clip => ({
  url: `https://www.twitch.tv/kaliyami/clip/${over.id}`,
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

const clips = [
  clip({ id: 'a', view_count: 9, creator_name: 'SpiZ', game_id: '1' }),
  clip({ id: 'b', view_count: 4, creator_name: 'Ori', game_id: '2' }),
  clip({ id: 'c', view_count: 7, creator_name: 'SpiZ', game_id: '2' }),
  clip({ id: 'd', view_count: 0, creator_name: 'Garami', game_id: '' }),
]

const ids = (result: Clip[]) => result.map((c) => c.id)

describe('applyFilters', () => {
  // L'ordre relève de sortClips : applyFilters préserve celui qu'il reçoit.
  it('renvoie tout, dans l’ordre reçu, sans filtre', () => {
    expect(ids(applyFilters(clips, NO_FILTERS))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('applique un plancher de vues, borne incluse', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, minViews: 7 }))).toEqual(['a', 'c'])
  })

  it('applique un plafond de vues, borne incluse', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, maxViews: 4 }))).toEqual(['b', 'd'])
  })

  it('combine plancher et plafond en intervalle', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, minViews: 4, maxViews: 7 }))).toEqual([
      'b',
      'c',
    ])
  })

  it('ne renvoie rien quand l’intervalle est inversé', () => {
    expect(applyFilters(clips, { ...NO_FILTERS, minViews: 8, maxViews: 2 })).toEqual([])
  })

  it('filtre par créateur', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ'] }))).toEqual(['a', 'c'])
  })

  it('filtre par jeu', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, gameIds: ['2'] }))).toEqual(['b', 'c'])
  })

  // Au sein d'une même facette les valeurs s'additionnent, entre facettes elles
  // se restreignent : « SpiZ ou Ori », mais « et sur le jeu 2 ».
  it('réunit les valeurs d’une même facette', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ', 'Ori'] }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('croise deux facettes différentes', () => {
    const result = applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ', 'Ori'], gameIds: ['2'] })

    expect(ids(result)).toEqual(['b', 'c'])
  })

  it('traite une liste vide comme absence de filtre', () => {
    expect(ids(applyFilters(clips, { ...NO_FILTERS, creators: [], gameIds: [] }))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('cumule des filtres de nature différente', () => {
    const result = applyFilters(clips, { ...NO_FILTERS, creators: ['SpiZ'], maxViews: 8 })

    expect(ids(result)).toEqual(['c'])
  })

  it('ne modifie pas le tableau reçu', () => {
    applyFilters(clips, NO_FILTERS)

    expect(ids(clips)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('facets', () => {
  it('compte les occurrences, les plus nombreuses d’abord', () => {
    expect(facets(clips, (c) => c.creator_name)).toEqual([
      { value: 'SpiZ', count: 2 },
      { value: 'Garami', count: 1 },
      { value: 'Ori', count: 1 },
    ])
  })

  it('départage les ex æquo par ordre alphabétique', () => {
    const facettes = facets(clips, (c) => c.creator_name)

    expect(facettes.slice(1).map((f) => f.value)).toEqual(['Garami', 'Ori'])
  })

  it('écarte les valeurs vides plutôt que d’offrir un filtre inutilisable', () => {
    expect(facets(clips, (c) => c.game_id)).toEqual([
      { value: '2', count: 2 },
      { value: '1', count: 1 },
    ])
  })

  it('ne renvoie rien pour une liste vide', () => {
    expect(facets([], (c) => c.creator_name)).toEqual([])
  })
})
