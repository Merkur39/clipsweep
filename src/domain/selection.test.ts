import { describe, expect, it } from 'vitest'

import { selectedClips, selectionState, toggle, toggleAll } from './selection'

const clips = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const none = new Set<string>()

describe('selectedClips', () => {
  // Selections are what gets stored, not exclusions: a clip that appears — a
  // raised threshold, a fresh sweep — therefore comes in unchecked.
  it('keeps nothing as long as nothing is checked', () => {
    expect(selectedClips(clips, none)).toEqual([])
  })

  it('keeps the checked clips, in display order', () => {
    expect(selectedClips(clips, new Set(['c', 'a'])).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('ignores a selection that matches no displayed clip', () => {
    expect(selectedClips(clips, new Set(['zzz'])).map((c) => c.id)).toEqual([])
  })
})

describe('toggle', () => {
  it('checks then unchecks a clip', () => {
    const on = toggle(none, 'b')
    expect([...on]).toEqual(['b'])
    expect([...toggle(on, 'b')]).toEqual([])
  })

  it('does not mutate the set it receives', () => {
    toggle(none, 'b')
    expect(none.size).toBe(0)
  })
})

describe('selectionState', () => {
  it('tells all, none, and partial apart', () => {
    expect(selectionState(clips, new Set(['a', 'b', 'c']))).toBe('all')
    expect(selectionState(clips, none)).toBe('none')
    expect(selectionState(clips, new Set(['b']))).toBe('some')
  })

  it('treats an empty list as unselected', () => {
    expect(selectionState([], none)).toBe('none')
  })
})

describe('toggleAll', () => {
  it('checks everything when nothing was checked', () => {
    expect([...toggleAll(clips, none)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('checks everything from a partial selection', () => {
    expect([...toggleAll(clips, new Set(['b']))].sort()).toEqual(['a', 'b', 'c'])
  })

  it('unchecks everything when everything was checked', () => {
    expect([...toggleAll(clips, new Set(['a', 'b', 'c']))]).toEqual([])
  })

  it('does not drop a checked clip the filter hides', () => {
    // 'hidden' is not displayed: unchecking all must leave it alone.
    const next = toggleAll(clips, new Set(['a', 'b', 'c', 'hidden']))

    expect([...next]).toEqual(['hidden'])
  })
})
