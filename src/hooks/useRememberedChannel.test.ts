// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useRememberedChannel } from './useRememberedChannel'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

describe('useRememberedChannel', () => {
  it('forgets the name typed, as long as nothing was asked', () => {
    const { result } = renderHook(() => useRememberedChannel())

    act(() => result.current.setChannel('zerator'))

    expect(result.current.remember).toBe(false)
    expect(localStorage.getItem('getclip.savedChannel')).toBeNull()
  })

  it('keeps the name typed once asked to', () => {
    const { result } = renderHook(() => useRememberedChannel())

    act(() => result.current.setRemember(true))
    act(() => result.current.setChannel('zerator'))

    expect(localStorage.getItem('getclip.savedChannel')).toBe('zerator')
  })

  // The choice is a preference, and outlives the tab like the theme does: kept
  // in the session alone it would have to be ticked again at every opening,
  // which is exactly the chore it exists to spare.
  it('keeps the choice itself durably', () => {
    const { result } = renderHook(() => useRememberedChannel())

    act(() => result.current.setRemember(true))

    expect(localStorage.getItem('getclip.remember')).toBe('on')
  })

  it('opens a new tab on the name kept', () => {
    localStorage.setItem('getclip.remember', 'on')
    localStorage.setItem('getclip.savedChannel', 'zerator')

    const { result } = renderHook(() => useRememberedChannel())

    expect(result.current.channel).toBe('zerator')
    expect(result.current.remember).toBe(true)
  })

  // A reload must find the target of the search in progress, not the one kept:
  // the tab has been typing over it since.
  it('lets the tab in progress outrank the name kept', () => {
    localStorage.setItem('getclip.remember', 'on')
    localStorage.setItem('getclip.savedChannel', 'zerator')
    sessionStorage.setItem('getclip.channel', 'ponce')

    const { result } = renderHook(() => useRememberedChannel())

    expect(result.current.channel).toBe('ponce')
  })

  // Unticking is a withdrawal of consent: it takes effect at once, not at the
  // next opening — and it takes nothing off the screen, the field keeps the
  // name it has.
  it('erases the name kept as soon as the box is unticked', () => {
    localStorage.setItem('getclip.remember', 'on')
    localStorage.setItem('getclip.savedChannel', 'zerator')

    const { result } = renderHook(() => useRememberedChannel())
    act(() => result.current.setRemember(false))

    expect(localStorage.getItem('getclip.savedChannel')).toBeNull()
    expect(result.current.channel).toBe('zerator')
  })

  /**
   * `forgetSessionScopedKeys` erases `getclip.channel` from durable storage at
   * every boot, and must keep doing so: what a version prior to 2026-08-02 left
   * there was never consented to. The name kept here is, hence its own key.
   */
  it('keeps the name away from the key the boot purge erases', () => {
    const { result } = renderHook(() => useRememberedChannel())

    act(() => result.current.setRemember(true))
    act(() => result.current.setChannel('zerator'))

    expect(localStorage.getItem('getclip.channel')).toBeNull()
    expect(sessionStorage.getItem('getclip.channel')).toBe('zerator')
  })
})
