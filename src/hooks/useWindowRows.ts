import { useEffect, useState, type RefObject } from 'react'

import { windowRows } from '../components/virtual'

export interface WindowRows {
  /** How far the rows have run past the top edge of the screen. */
  scrollTop: number
  /** How much of the screen is left for them. */
  viewportHeight: number
  /** The width they are drawn across, which decides how many columns fit. */
  width: number
}

/**
 * Before the first measurement: a plausible stage rather than a blank one. A
 * width of zero would collapse the board to a single column for one frame, and
 * a height of zero would mount nothing at all.
 */
const INITIAL: WindowRows = { scrollTop: 0, viewportHeight: 560, width: 900 }

const same = (a: WindowRows, b: WindowRows) =>
  a.scrollTop === b.scrollTop && a.viewportHeight === b.viewportHeight && a.width === b.width

/**
 * The window seen as the scroller, for a readout that flows in the page.
 *
 * Both readouts used to scroll inside a box of their own, and read their window
 * off that box. They no longer have one — the design has them flowing in the
 * page, which is what scrolls — so the three figures the virtualiser needs come
 * from one rect and one `innerHeight`.
 *
 * ⚠️ **A rect of no width is not a measurement.** jsdom lays nothing out, and a
 * node inside something folded away measures the same zero; taken at face value
 * either would collapse the board to a single column. The last real measurement
 * stands instead, which is also what keeps the component's tests describing a
 * stage rather than a point.
 *
 * The rect is read on every scroll event, deliberately: it answers both
 * questions at once and needs no document offset kept in sync — one layout read
 * on one element, which is what the browser is fastest at.
 */
export function useWindowRows(ref: RefObject<HTMLElement | null>): WindowRows {
  const [rows, setRows] = useState(INITIAL)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const measure = () => {
      const rect = node.getBoundingClientRect()
      if (rect.width === 0) return

      const next = {
        ...windowRows({ top: rect.top, innerHeight: window.innerHeight }),
        width: rect.width,
      }
      setRows((previous) => (same(previous, next) ? previous : next))
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    // What moves the rows without the window moving: the ticket folding, the
    // drawer opening, a filter emptying the list.
    const observer = new ResizeObserver(measure)
    observer.observe(node)

    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [ref])

  return rows
}
