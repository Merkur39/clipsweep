// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useScrolledPast } from './useScrolledPast'

/**
 * The two figures the answer rests on. jsdom holds both and never moves either
 * on its own, so the test moves them and then says so, exactly as a browser
 * would — the value is read on the event, not polled.
 */
const set = (values: { scrollY?: number; innerHeight?: number }) => {
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(window, name, { configurable: true, value })
  }
}

const scrollTo = (scrollY: number) =>
  act(() => {
    set({ scrollY })
    window.dispatchEvent(new Event('scroll'))
  })

const resizeTo = (innerHeight: number) =>
  act(() => {
    set({ innerHeight })
    window.dispatchEvent(new Event('resize'))
  })

/** jsdom's own defaults, put back so no test inherits another's window. */
afterEach(() => set({ scrollY: 0, innerHeight: 768 }))

describe('useScrolledPast', () => {
  it('does not hold at the top of the page', () => {
    const { result } = renderHook(() => useScrolledPast(0.5))

    expect(result.current).toBe(false)
  })

  // Half a screen of a 800px window is 400px, and not one pixel less: the
  // threshold is the distance itself, not a rounding of it.
  it('holds once the asked-for share of a screen has gone by', () => {
    set({ innerHeight: 800 })
    const { result } = renderHook(() => useScrolledPast(0.5))

    scrollTo(399)
    expect(result.current).toBe(false)

    scrollTo(400)
    expect(result.current).toBe(true)
  })

  it('lets go when the page comes back up', () => {
    set({ innerHeight: 800, scrollY: 900 })
    const { result } = renderHook(() => useScrolledPast(0.5))

    scrollTo(0)

    expect(result.current).toBe(false)
  })

  // The distance is a share of the window, so it moves with the window: the
  // same 300px is half a phone's screen and a fifth of a desktop's.
  it('re-reads the distance when the window changes size', () => {
    set({ innerHeight: 1200, scrollY: 300 })
    const { result } = renderHook(() => useScrolledPast(0.5))

    expect(result.current).toBe(false)

    resizeTo(600)

    expect(result.current).toBe(true)
  })

  it('stops listening when it goes', () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const count = (spy: typeof added) =>
      spy.mock.calls.filter(([name]) => name === 'scroll' || name === 'resize').length

    const { unmount } = renderHook(() => useScrolledPast(0.5))
    expect(count(added)).toBeGreaterThan(0)

    unmount()

    expect(count(removed)).toBe(count(added))
  })
})
