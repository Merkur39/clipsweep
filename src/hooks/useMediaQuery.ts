import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, read as browser state rather than mirrored
 * into a `useState`.
 *
 * `useSyncExternalStore` is what makes the first render already right: the
 * value is read at render time, not written by an effect afterwards, so the
 * layout never paints in the wrong tier and then jumps. There is no server
 * render here to disagree with — the application is client-rendered — but the
 * server snapshot is supplied all the same, and it answers "no" because the
 * wide layout is the one every rule is written against.
 *
 * The whole appearance of a breakpoint belongs in the sheet; this hook exists
 * for the one thing a media query cannot do, which is to change *which*
 * elements are mounted. The rail and the compact search line hold the same
 * fields: rendering both and hiding one would give the channel two inputs
 * carrying one accessible name.
 */
/**
 * One `MediaQueryList` per query string, for the lifetime of the document.
 *
 * Not an optimisation. `matchMedia` mints a fresh object on every call, and a
 * subscriber that lets go of its own would be listening to something only the
 * listener list keeps alive — engines have collected those. Worse here, the
 * subscription and the snapshot are two separate callbacks: without this cache
 * they would each hold a different object, and the one that notifies would not
 * be the one that is read.
 */
const lists = new Map<string, MediaQueryList>()

function listFor(query: string): MediaQueryList | null {
  // Absent in jsdom without the stub, and in any engine old enough to lack it.
  if (typeof globalThis.matchMedia !== 'function') return null

  const existing = lists.get(query)
  if (existing) return existing

  const created = globalThis.matchMedia(query)
  lists.set(query, created)
  return created
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = listFor(query)
      // Nothing to listen to: the snapshot below stays false and the wide
      // layout — the one every rule is written against — is what renders.
      if (!list) return () => {}

      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  const snapshot = useCallback(() => listFor(query)?.matches ?? false, [query])

  return useSyncExternalStore(subscribe, snapshot, () => false)
}
