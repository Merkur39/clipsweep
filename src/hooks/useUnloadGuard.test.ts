// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useUnloadGuard } from './useUnloadGuard'

/** The browser only asks for confirmation if the event is cancelled. */
const leave = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('useUnloadGuard', () => {
  // A guard that fires on an empty page is nothing but a nuisance.
  it('lets you leave when there is nothing to lose', () => {
    renderHook(() => useUnloadGuard(false))

    expect(leave()).toBe(false)
  })

  it('asks for confirmation when there is something to lose', () => {
    renderHook(() => useUnloadGuard(true))

    expect(leave()).toBe(true)
  })

  it('stops guarding as soon as there is nothing left to lose', () => {
    const { rerender } = renderHook(({ active }) => useUnloadGuard(active), {
      initialProps: { active: true },
    })
    expect(leave()).toBe(true)

    rerender({ active: false })

    expect(leave()).toBe(false)
  })

  // A listener left behind would guard a page with nothing left to lose.
  it('removes its listener on unmount', () => {
    const { unmount } = renderHook(() => useUnloadGuard(true))

    unmount()

    expect(leave()).toBe(false)
  })
})
