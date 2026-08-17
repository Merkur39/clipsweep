import { useEffect, useRef, useState } from 'react'

/** How often the readout ticks while a sweep runs. Seconds are the unit shown. */
const TICK_MS = 1000

/**
 * How long the current sweep has been running, or how long the last one took.
 *
 * Timed here rather than inside the search, because it is a readout and not a
 * result: nothing in the collection depends on it, and threading a clock
 * through the hook would make every sweep observe the wall clock it does not
 * need. Null before the first sweep, so the rail can draw its row empty.
 *
 * The tick only exists while running. Once the sweep is over the value is
 * frozen, which is what lets the rail say "last sweep" without the figure
 * quietly growing under the eye.
 */
export function useElapsed(running: boolean): number | null {
  const startedAt = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)

  useEffect(() => {
    if (!running) return

    // A fresh start, not a resumption: the previous sweep's total is replaced
    // the moment a new one begins, never added to.
    startedAt.current = Date.now()
    setElapsed(0)

    const timer = setInterval(
      () => setElapsed(Date.now() - (startedAt.current ?? Date.now())),
      TICK_MS,
    )

    // The last reading is taken on the way out: stopping between two ticks
    // would otherwise leave the figure up to a second short of the truth.
    return () => {
      clearInterval(timer)
      setElapsed(Date.now() - (startedAt.current ?? Date.now()))
    }
  }, [running])

  return elapsed
}
