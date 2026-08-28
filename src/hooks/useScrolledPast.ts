import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether the page has run further down than a given share of a screen.
 *
 * A share rather than a distance in pixels, because what is being asked is
 * "has the top of the page gone?" and that question is answered in screens: the
 * same 300px is half of a phone's window and a fifth of a desktop's. A fixed
 * threshold would put the control on screen while the masthead was still in
 * plain sight on one machine, and long after it had left on the other.
 *
 * Built on `useSyncExternalStore` for the reason `useMediaQuery` is: the value
 * lives outside React and is read on every render. State seeded then corrected
 * in an effect reads the same and is not — it costs a second render pass, and
 * it renders the wrong answer for one frame on a page restored mid-scroll.
 *
 * The snapshot is a boolean, which is what makes this safe: `scrollY` itself
 * would be a new answer on every pixel and would re-render the tree with it.
 */
export function useScrolledPast(screens: number): boolean {
  const subscribe = useCallback((notify: () => void) => {
    // Passive: this listener never cancels a scroll, and saying so is what
    // keeps it off the critical path of the gesture.
    window.addEventListener('scroll', notify, { passive: true })
    // A window that changes height moves the threshold without the page
    // moving — a phone's address bar retracting is enough.
    window.addEventListener('resize', notify)

    return () => {
      window.removeEventListener('scroll', notify)
      window.removeEventListener('resize', notify)
    }
  }, [])

  return useSyncExternalStore(subscribe, () => window.scrollY >= window.innerHeight * screens)
}
