// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLatest } from './useLatest'

describe('useLatest', () => {
  it('hands back the value of the render it was last given', () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 'first' },
    })

    rerender({ value: 'second' })

    expect(result.current.current).toBe('second')
  })

  /* The whole point: a listener registered once has to reach the callback of
     the current render without the effect that registered it being torn down,
     so the identity of what it holds must never change. */
  it('keeps one ref for the life of the component', () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 1 },
    })
    const first = result.current

    rerender({ value: 2 })

    expect(result.current).toBe(first)
  })
})
