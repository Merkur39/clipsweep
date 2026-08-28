// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from './useMediaQuery'

/** A media query whose answer the test decides, and can change. */
const stub = (matches: boolean) => {
  const listeners = new Set<() => void>()
  const media = {
    get matches() {
      return current
    },
    addEventListener: (_: string, run: () => void) => listeners.add(run),
    removeEventListener: (_: string, run: () => void) => listeners.delete(run),
  }
  let current = matches
  vi.stubGlobal('matchMedia', () => media)
  return {
    set(next: boolean) {
      current = next
      listeners.forEach((run) => run())
    },
    get listening() {
      return listeners.size
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('useMediaQuery', () => {
  // Read before the first paint: a value that started false and corrected
  // itself in an effect would render the wide layout for one frame on a phone.
  it('answers from the first render', () => {
    stub(true)

    const { result } = renderHook(() => useMediaQuery('(max-width: 700px)'))

    expect(result.current).toBe(true)
  })

  it('follows the window across the threshold', () => {
    const media = stub(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 700px)'))

    act(() => media.set(true))

    expect(result.current).toBe(true)
  })

  it('stops listening when it goes', () => {
    const media = stub(false)
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 700px)'))

    unmount()

    expect(media.listening).toBe(0)
  })
})
