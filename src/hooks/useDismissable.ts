import { useEffect, useRef } from 'react'

import { useLatest } from './useLatest'

/**
 * How many of these are open at this instant.
 *
 * The escape key belongs to the innermost thing that is open, and this is how
 * something further out finds out that it is not innermost — see
 * [escapeIsTaken]. Nothing else can tell it: every listener here sits on
 * `document` in the bubble phase, so they all fire on one press, in the order
 * they were registered rather than in the order they were stacked.
 */
let openCount = 0

/**
 * Is the escape key already spoken for by something on top?
 *
 * For whatever hangs open around a popover without being one — the search
 * ticket, which is a section of the page and does not dismiss on a click
 * landing outside it. A `<dialog>` counts too, and it is the browser rather
 * than this module that closes it: `showModal` answers the key itself, and the
 * press still reaches `document` on the way past.
 */
export const escapeIsTaken = () => openCount > 0 || document.querySelector('dialog[open]') !== null

/**
 * The two ways out of anything that hangs open: a click landing outside it, and
 * the escape key.
 *
 * It returns the ref to put on the root — what counts as "outside" is measured
 * against that element, so the control that opened the thing has to be inside
 * it, otherwise the click that closes it reopens it on the way out.
 *
 * No listener runs while nothing is open.
 */
export function useDismissable<T extends HTMLElement>(open: boolean, onDismiss: () => void) {
  const rootRef = useRef<T>(null)
  /* Keyed on `open` alone: `onDismiss` is rebuilt on every render and listing
     it here would tear the listeners down and set them up again on every
     keystroke of the page. The ref is what lets the pair follow `open` and
     still call the callback of the current render. */
  const dismiss = useLatest(onDismiss)

  useEffect(() => {
    if (!open) return

    openCount += 1

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) dismiss.current()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss.current()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      openCount -= 1
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, dismiss])

  return rootRef
}
