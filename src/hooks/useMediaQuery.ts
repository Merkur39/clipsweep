import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a media query holds, as a value the render can branch on.
 *
 * For what CSS cannot do on its own: a sheet can hide a control, it cannot fold
 * four of them into one. Anything that is only a matter of size, spacing or
 * visibility stays in the sheet — this is for the places where the narrow screen
 * wants a *different* control, not a smaller one.
 *
 * Built on `useSyncExternalStore`, which is the shape this actually has: a
 * subscription to something outside React, read on every render. The obvious
 * spelling — state seeded from `matchMedia`, then corrected in an effect — reads
 * the same and is not: the correction is a `setState` inside an effect body,
 * which React answers with a second render pass, and which the linter is right
 * to refuse. Here the value is read where it is used and nothing is stored.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', notify)
      return () => media.removeEventListener('change', notify)
    },
    [query],
  )

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
