// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { tokenStore } from '../twitch/auth'

import { forgetSessionScopedKeys, persistedKey, usePersistedState } from './usePersistedState'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

describe('usePersistedState', () => {
  it('starts from the initial value with no stored entry', () => {
    const { result } = renderHook(() => usePersistedState('channel', 'fallback'))

    expect(result.current[0]).toBe('fallback')
  })

  it('picks up the value stored under the prefixed key', () => {
    localStorage.setItem('getclip.channel', 'kept')

    const { result } = renderHook(() => usePersistedState('channel', 'fallback'))

    expect(result.current[0]).toBe('kept')
  })

  it('stores every new value', () => {
    const { result } = renderHook(() => usePersistedState('channel', 'fallback'))

    act(() => result.current[1]('typed'))

    expect(localStorage.getItem('getclip.channel')).toBe('typed')
  })

  // The theme is a durable preference: it must outlive the tab's closing, and
  // `main.tsx` reads it back under that same key before the first render.
  it('writes to localStorage by default', () => {
    renderHook(() => usePersistedState('theme', 'dark'))

    expect(localStorage.getItem('getclip.theme')).toBe('dark')
    expect(sessionStorage.getItem('getclip.theme')).toBeNull()
  })

  // What targets a sweep — channel and period — has no business outliving the
  // tab: finding yesterday's target again would restart a sweep nobody chose.
  it('writes to the store it is given, without touching the other', () => {
    renderHook(() => usePersistedState('channel', 'typed', sessionStorage))

    expect(sessionStorage.getItem('getclip.channel')).toBe('typed')
    expect(localStorage.getItem('getclip.channel')).toBeNull()
  })

  it('reads back the store it is given', () => {
    sessionStorage.setItem('getclip.since', '2026-07-02')

    const { result } = renderHook(() => usePersistedState('since', '2019-01-01', sessionStorage))

    expect(result.current[0]).toBe('2026-07-02')
  })

  it('prefixes keys so it does not trample the rest of the origin', () => {
    expect(persistedKey('channel')).toBe('getclip.channel')
  })
})

// These keys lived in localStorage until 2026-08-02. Ceasing to read them does
// not erase them: without this purge, the channel visited and the period
// searched back then would stay on the visitor's machine indefinitely, serving
// nothing — the opposite of what moving to sessionStorage was after.
describe('forgetSessionScopedKeys', () => {
  it('erases the keys that no longer belong in durable storage', () => {
    const orphans = ['getclip.channel', 'getclip.channels', 'getclip.since', 'getclip.until']
    for (const key of orphans) localStorage.setItem(key, 'leftover')

    forgetSessionScopedKeys(localStorage)

    expect(orphans.map((key) => localStorage.getItem(key))).toEqual([null, null, null, null])
    expect(localStorage.length).toBe(0)
  })

  it('leaves the theme alone, which is a durable preference', () => {
    localStorage.setItem('getclip.theme', 'dark')

    forgetSessionScopedKeys(localStorage)

    expect(localStorage.getItem('getclip.theme')).toBe('dark')
  })

  // This pass runs at every boot, over the store the token now lives in. Adding
  // `token` to the list it erases would sign every visitor out on arrival, and
  // nothing else would report it.
  it('leaves the token alone, kept on purpose across visits', () => {
    tokenStore.write('a-live-token')

    forgetSessionScopedKeys(localStorage)

    expect(tokenStore.read()).toBe('a-live-token')
  })

  it('leaves intact what does not belong to the application', () => {
    localStorage.setItem('channel', 'someone else’s')

    forgetSessionScopedKeys(localStorage)

    expect(localStorage.getItem('channel')).toBe('someone else’s')
  })
})
