// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { escapeIsTaken, useDismissable } from './useDismissable'

/**
 * The two ways out of anything that hangs open: a click landing outside it, and
 * the escape key.
 */
describe('useDismissable', () => {
  it('closes on a click landing outside the root', () => {
    const onDismiss = vi.fn()
    renderHook(() => useDismissable<HTMLDivElement>(true, onDismiss))

    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(onDismiss).toHaveBeenCalled()
  })

  it('closes on the escape key', () => {
    const onDismiss = vi.fn()
    renderHook(() => useDismissable<HTMLDivElement>(true, onDismiss))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onDismiss).toHaveBeenCalled()
  })

  it('listens to nothing while it is shut', () => {
    const onDismiss = vi.fn()
    renderHook(() => useDismissable<HTMLDivElement>(false, onDismiss))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onDismiss).not.toHaveBeenCalled()
  })
})

/**
 * Who owns the escape key at this instant — asked by whatever hangs open around
 * a popover without being one, and answered by the count of popovers on top of
 * it.
 *
 * The count is module state, so what matters is that it comes back down: a
 * decrement that went missing would leave the outer thing deaf to the key for
 * the rest of the session, with nothing on screen to explain it.
 */
describe('escapeIsTaken', () => {
  it('belongs to nobody with nothing open', () => {
    expect(escapeIsTaken()).toBe(false)
  })

  it('is taken while a popover is open', () => {
    renderHook(() => useDismissable<HTMLDivElement>(true, vi.fn()))

    expect(escapeIsTaken()).toBe(true)
  })

  it('gives it back when the popover closes', () => {
    const { rerender } = renderHook(({ open }) => useDismissable<HTMLDivElement>(open, vi.fn()), {
      initialProps: { open: true },
    })

    rerender({ open: false })

    expect(escapeIsTaken()).toBe(false)
  })

  it('gives it back when the popover unmounts with it', () => {
    const { unmount } = renderHook(() => useDismissable<HTMLDivElement>(true, vi.fn()))

    unmount()

    expect(escapeIsTaken()).toBe(false)
  })

  /* The browser answers the key for a modal itself, and the press still travels
     to `document` on the way past: whoever listens there has to stand down. */
  it('is taken while a dialog stands open', () => {
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)

    try {
      expect(escapeIsTaken()).toBe(true)
    } finally {
      dialog.remove()
    }
  })
})
