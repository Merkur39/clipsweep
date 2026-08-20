import { describe, expect, it } from 'vitest'

import { tileGeometry } from './tileGeometry'
import { gridMetrics } from './virtual'

/** The stage at 1440, its gutters taken out; and a phone, likewise. */
const DESKTOP = 1376
const PHONE = 366

const columns = (width: number, dense: boolean) =>
  gridMetrics({ width, ...tileGeometry(dense, width) }).perRow

describe('tileGeometry', () => {
  it('draws three large tiles across the stage, and five tight ones', () => {
    expect(columns(DESKTOP, false)).toBe(3)
    expect(columns(DESKTOP, true)).toBe(5)
  })

  /**
   * A phone's idea of tight is not a desktop's. Holding the desktop minimum on
   * a 390-wide screen would collapse the tight gallery to a single column —
   * which is the large one, and leaves the density control with two states out
   * of three saying the same thing.
   */
  it('keeps the tight gallery worth choosing on a phone', () => {
    expect(columns(PHONE, false)).toBe(1)
    expect(columns(PHONE, true)).toBe(2)
  })

  /** More columns can only mean narrower tiles, at every width. */
  it('never gives the tight gallery fewer columns than the large one', () => {
    for (const width of [320, 480, 640, 768, 1024, 1280, 1440, 1920, 2560]) {
      expect(columns(width, true)).toBeGreaterThanOrEqual(columns(width, false))
    }
  })

  /**
   * The tight tile carries one more line under the thumbnail — the date and the
   * game, which the large one leaves out. `metaHeight` is what the virtualiser
   * places rows on, so it has to grow with it.
   */
  it('gives the tight tile room for the line the large one does without', () => {
    expect(tileGeometry(true, DESKTOP).metaHeight).toBeGreaterThan(
      tileGeometry(false, DESKTOP).metaHeight,
    )
  })
})
