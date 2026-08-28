// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCountdown } from './useCountdown'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useCountdown', () => {
  it('counts nothing while nothing is running out', () => {
    const { result } = renderHook(() => useCountdown(null))

    expect(result.current).toBeNull()
  })

  // The first reading is the one the reader sees first: a clock kept in state
  // would still be showing its initial value half a second in.
  it('is right on its first render, before any tick', () => {
    const { result } = renderHook(() => useCountdown(Date.now() + 34_000))

    expect(result.current).toBe(34)
  })

  it('counts down as the clock moves', async () => {
    // The deadline is settled once, outside the render: computed inside it, it
    // would slide forward on every tick and the count would never move.
    const until = Date.now() + 10_000
    const { result } = renderHook(() => useCountdown(until))

    await act(async () => void vi.advanceTimersByTime(3_000))

    expect(result.current).toBe(7)
  })

  it('stops at zero rather than going past it', async () => {
    const until = Date.now() + 2_000
    const { result } = renderHook(() => useCountdown(until))

    await act(async () => void vi.advanceTimersByTime(10_000))

    expect(result.current).toBe(0)
  })

  it('leaves no timer running once there is nothing to count', () => {
    const { rerender } = renderHook(({ until }) => useCountdown(until), {
      initialProps: { until: (Date.now() + 10_000) as number | null },
    })
    expect(vi.getTimerCount()).toBe(1)

    rerender({ until: null })

    expect(vi.getTimerCount()).toBe(0)
  })
})
