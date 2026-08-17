/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from './useMediaQuery'

/**
 * A `matchMedia` one can drive.
 *
 * The real one cannot be exercised in a test runner, and it cannot be exercised
 * in a headless browser pane either: resizing there updates `innerWidth` and
 * `matches` while dispatching neither `resize` nor `change`, so a hook that
 * never re-rendered would look exactly like a hook that worked. This stub is
 * the only place the notification itself is observable.
 *
 * Each list is remembered by query, because the hook caches its own the same
 * way: `flip` has to reach the object the hook subscribed to, or the test would
 * prove nothing about the object it reads.
 */
function driveMatchMedia() {
  const lists = new Map<string, { matches: boolean; fire: () => void }>()

  window.matchMedia = ((query: string) => {
    const listeners = new Set<() => void>()
    const existing = lists.get(query)

    const list = {
      get matches() {
        return lists.get(query)?.matches ?? false
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => void listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => void listeners.delete(fn),
    }

    if (!existing) {
      lists.set(query, { matches: false, fire: () => listeners.forEach((fn) => fn()) })
    } else {
      // The hook asked twice for one query: keep the first list's listeners so
      // the second caller is notified through the same channel.
      const previous = existing.fire
      lists.set(query, {
        matches: existing.matches,
        fire: () => {
          previous()
          listeners.forEach((fn) => fn())
        },
      })
    }

    return list
  }) as unknown as typeof window.matchMedia

  return {
    flip(query: string, matches: boolean) {
      const entry = lists.get(query)
      if (!entry) throw new Error(`nothing subscribed to ${query}`)
      entry.matches = matches
      act(() => entry.fire())
    },
    listened: (query: string) => lists.has(query),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('useMediaQuery', () => {
  it('reads the query at the first render, without waiting for an effect', () => {
    const media = driveMatchMedia()
    // Matching before anything mounts: the value has to be right on the first
    // paint, or the page renders one tier and jumps to the other.
    const { result } = renderHook(() => useMediaQuery('(min-width: 640px)'))
    expect(media.listened('(min-width: 640px)')).toBe(true)
    expect(result.current).toBe(false)
  })

  it('follows the query when it changes under the page', () => {
    const media = driveMatchMedia()
    const { result } = renderHook(() => useMediaQuery('(min-width: 641px)'))

    expect(result.current).toBe(false)
    media.flip('(min-width: 641px)', true)
    expect(result.current).toBe(true)
    media.flip('(min-width: 641px)', false)
    expect(result.current).toBe(false)
  })

  it('answers no, rather than throwing, where there is no matchMedia at all', () => {
    // The shape an engine without media queries presents — and the shape jsdom
    // presents without the stub in `test-setup`.
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useMediaQuery('(min-width: 642px)'))
    expect(result.current).toBe(false)
  })
})
