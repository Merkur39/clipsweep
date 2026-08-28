import { useEffect, useReducer } from 'react'

/** How often the clock is read again; twice a second, so no second is skipped. */
const TICK_MS = 500

/**
 * The whole seconds left before `until`, or null when nothing is running out.
 *
 * The clock is read during the render rather than kept in state, and the
 * interval only forces the render: a `now` held in state is a second value to
 * keep in step with the real one, and it starts out stale — the first tick
 * arrives half a second after the countdown does, so the first thing the reader
 * would see is the wrong number.
 *
 * No timer runs while there is nothing to count.
 */
export function useCountdown(until: number | null): number | null {
  const [, tick] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    if (until === null) return

    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [until])

  if (until === null) return null
  // Rounded up, and never past zero: "0 second left" is what the last half
  // second reads as, and a negative count is a clock that has overshot.
  //
  // The one deliberate impurity of the codebase, and the whole point of the hook
  // — see above: a `now` held in state starts stale, and the first thing the
  // reader would see is the wrong number. The interval is what forces the render
  // that reads the clock again.
  // eslint-disable-next-line react-hooks/purity
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}
