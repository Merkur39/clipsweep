// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useUnloadGuard } from './useUnloadGuard'

afterEach(cleanup)

/** Le navigateur ne demande confirmation que si l'évènement est annulé. */
const quitter = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('useUnloadGuard', () => {
  // Une garde qui se déclenche sur une page vide n'est qu'une gêne.
  it('laisse partir quand il n’y a rien à perdre', () => {
    renderHook(() => useUnloadGuard(false))

    expect(quitter()).toBe(false)
  })

  it('demande confirmation quand il y a quelque chose à perdre', () => {
    renderHook(() => useUnloadGuard(true))

    expect(quitter()).toBe(true)
  })

  it('cesse de garder dès qu’il n’y a plus rien à perdre', () => {
    const { rerender } = renderHook(({ actif }) => useUnloadGuard(actif), {
      initialProps: { actif: true },
    })
    expect(quitter()).toBe(true)

    rerender({ actif: false })

    expect(quitter()).toBe(false)
  })

  // Un écouteur laissé derrière garderait une page qui n'a plus rien à perdre.
  it('retire son écouteur au démontage', () => {
    const { unmount } = renderHook(() => useUnloadGuard(true))

    unmount()

    expect(quitter()).toBe(false)
  })
})
