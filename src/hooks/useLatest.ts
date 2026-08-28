import { useEffect, useRef, type RefObject } from 'react'

/**
 * The current render's value, reachable from a listener registered by an
 * earlier one.
 *
 * The problem it answers appears wherever a `useEffect` puts a handler on
 * `document`: the callback it closes over is rebuilt on every render, so listing
 * it in the dependency array tears the listener down and sets it up again on
 * each keystroke — and leaving it out silently freezes the callback of the
 * render that registered it. The ref is the third way: its identity never
 * changes, so the effect keeps its narrow dependencies **and** reads the latest
 * value through `.current`.
 *
 * Written after the render rather than during it: a ref mutated while rendering
 * is a side effect on a render React is free to throw away.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const latest = useRef(value)

  useEffect(() => {
    latest.current = value
  })

  return latest
}
