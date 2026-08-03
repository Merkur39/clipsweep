import { describe, expect, it } from 'vitest'

import { selectedClips, selectionState, toggle, toggleAll } from './selection'

const clips = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const none = new Set<string>()

describe('selectedClips', () => {
  // Ce sont les exclusions qui sont stockées, pas les sélections : un clip qui
  // apparaît (seuil relevé, nouveau scan) est donc coché d’office.
  it('retient tout tant que rien n’est décoché', () => {
    expect(selectedClips(clips, none).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('écarte les clips décochés', () => {
    expect(selectedClips(clips, new Set(['b'])).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('ignore une exclusion qui ne concerne aucun clip affiché', () => {
    expect(selectedClips(clips, new Set(['zzz'])).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('toggle', () => {
  it('décoche puis recoche un clip', () => {
    const off = toggle(none, 'b')
    expect([...off]).toEqual(['b'])
    expect([...toggle(off, 'b')]).toEqual([])
  })

  it('ne modifie pas l’ensemble reçu', () => {
    toggle(none, 'b')
    expect(none.size).toBe(0)
  })
})

describe('selectionState', () => {
  it('distingue tout, rien, et partiel', () => {
    expect(selectionState(clips, none)).toBe('all')
    expect(selectionState(clips, new Set(['a', 'b', 'c']))).toBe('none')
    expect(selectionState(clips, new Set(['b']))).toBe('some')
  })

  it('considère une liste vide comme non sélectionnée', () => {
    expect(selectionState([], none)).toBe('none')
  })
})

describe('toggleAll', () => {
  it('tout décoche quand tout était coché', () => {
    expect([...toggleAll(clips, none)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('tout recoche depuis une sélection partielle', () => {
    expect([...toggleAll(clips, new Set(['b']))]).toEqual([])
  })

  it('tout recoche quand rien n’était coché', () => {
    expect([...toggleAll(clips, new Set(['a', 'b', 'c']))]).toEqual([])
  })

  it('ne ressuscite pas un clip décoché que le filtre masque', () => {
    // 'masque' n’est pas affiché : tout cocher ne doit pas le réintégrer.
    const next = toggleAll(clips, new Set(['b', 'masque']))

    expect([...next]).toEqual(['masque'])
  })
})
