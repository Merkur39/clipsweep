import { describe, expect, it } from 'vitest'

import { selectedClips, selectionState, toggle, toggleAll } from './selection'

const clips = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const none = new Set<string>()

describe('selectedClips', () => {
  // Exclusions are what gets stored, not selections: a clip that appears — a
  // raised threshold, a fresh sweep — therefore comes in already checked.
  it('keeps everything as long as nothing is unchecked', () => {
    expect(selectedClips(clips, none).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops the unchecked clips', () => {
    expect(selectedClips(clips, new Set(['b'])).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('ignores an exclusion that matches no displayed clip', () => {
    expect(selectedClips(clips, new Set(['zzz'])).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('toggle', () => {
  it('unchecks then rechecks a clip', () => {
    const off = toggle(none, 'b')
    expect([...off]).toEqual(['b'])
    expect([...toggle(off, 'b')]).toEqual([])
  })

  it('does not mutate the set it receives', () => {
    toggle(none, 'b')
    expect(none.size).toBe(0)
  })
})

describe('selectionState', () => {
  it('tells all, none, and partial apart', () => {
    expect(selectionState(clips, none)).toBe('all')
    expect(selectionState(clips, new Set(['a', 'b', 'c']))).toBe('none')
    expect(selectionState(clips, new Set(['b']))).toBe('some')
  })

  it('treats an empty list as unselected', () => {
    expect(selectionState([], none)).toBe('none')
  })
})

describe('toggleAll', () => {
  it('unchecks everything when everything was checked', () => {
    expect([...toggleAll(clips, none)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('rechecks everything from a partial selection', () => {
    expect([...toggleAll(clips, new Set(['b']))]).toEqual([])
  })

  it('rechecks everything when nothing was checked', () => {
    expect([...toggleAll(clips, new Set(['a', 'b', 'c']))]).toEqual([])
  })

  it('does not revive an unchecked clip the filter hides', () => {
    // 'hidden' is not displayed: checking all must not bring it back in.
    const next = toggleAll(clips, new Set(['b', 'hidden']))

    expect([...next]).toEqual(['hidden'])
  })
})
