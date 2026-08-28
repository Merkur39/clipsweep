// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { render } from '../test-render'
import type { WindowReport } from '../twitch/clips'
import { Timeline } from './Timeline'

const report = (over: Partial<WindowReport> & { clipCount: number }): WindowReport => ({
  window: { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-02-01T00:00:00Z' },
  depth: 0,
  saturated: false,
  split: false,
  ...over,
})

const SPAN = { from: Date.parse('2024-01-01T00:00:00Z'), to: Date.parse('2024-06-01T00:00:00Z') }

const bars = () => [...document.querySelectorAll('.slab')] as HTMLElement[]

/**
 * A strip of slices, one bar each: what the search cut the period into, and how
 * much each cut brought back. Not a chart against a time axis — the bars are
 * evenly wide whatever the slice lasted, because what is being read is the run
 * of slices, not the calendar.
 */
describe('Timeline', () => {
  it('draws one bar per slice', () => {
    render(
      <Timeline
        span={SPAN}
        reports={[report({ clipCount: 12 }), report({ clipCount: 40 }), report({ clipCount: 3 })]}
      />,
    )

    expect(bars()).toHaveLength(3)
  })

  /**
   * A month and a day are the same bar: the strip reads as the run of slices,
   * not as a calendar. jsdom lays nothing out, so what is checked is the
   * mechanism — no bar carries a horizontal position of its own, and the row
   * shares its width between them.
   */
  it('draws a long slice and a short one alike', () => {
    render(
      <Timeline
        span={SPAN}
        reports={[
          report({ clipCount: 12 }),
          report({
            clipCount: 12,
            window: { startedAt: '2024-03-01T00:00:00Z', endedAt: '2024-03-02T00:00:00Z' },
          }),
        ]}
      />,
    )

    for (const bar of bars()) {
      expect(bar.style.left).toBe('')
      expect(bar.style.width).toBe('')
    }
  })

  /**
   * The scale is logarithmic — a slice brings back three clips or three
   * thousand — so what a height can be read for is the comparison, which is
   * what the readout under it is there to make exact.
   */
  it('draws the fuller slice taller', () => {
    render(
      <Timeline span={SPAN} reports={[report({ clipCount: 4 }), report({ clipCount: 900 })]} />,
    )
    const [low, high] = bars().map((bar) => parseFloat(bar.style.height))

    expect(high).toBeGreaterThan(low)
  })

  // A slice that found nothing still leaves a mark on the paper: it was
  // explored, and an absence is a result.
  it('leaves a mark for a slice that found nothing', () => {
    render(<Timeline span={SPAN} reports={[report({ clipCount: 0 })]} />)

    expect(parseFloat(bars()[0].style.height)).toBeGreaterThan(0)
  })

  /* The three states the legend names, told apart by more than their height:
     one was cut in two and run again, the other could not be. */
  it('tells the halved and the lost slices from the complete ones', () => {
    render(
      <Timeline
        span={SPAN}
        reports={[
          report({ clipCount: 12 }),
          report({ clipCount: 950, saturated: true, split: true }),
          report({ clipCount: 950, saturated: true, split: false }),
        ]}
      />,
    )

    expect(bars().map((bar) => bar.className)).toEqual(['slab done', 'slab split', 'slab lost'])
  })

  /**
   * The readout is what the graticule used to be: the strip says which slice is
   * fuller, and this says by how much. Without it the heights would be the only
   * thing said about a scale nobody can see.
   */
  it('says what a slice holds once the pointer is on it', () => {
    render(<Timeline span={SPAN} reports={[report({ clipCount: 412 })]} />)

    fireEvent.pointerEnter(bars()[0])

    expect(screen.getByText('412 clips')).toBeInTheDocument()
  })

  it('states the period while nothing is pointed at', () => {
    render(<Timeline span={SPAN} reports={[report({ clipCount: 412 })]} />)

    expect(screen.getByText(/01\/01\/2024/)).toBeInTheDocument()
  })

  // Before the first slice has reported there is nothing to plot, and an empty
  // strip is a drawing of nothing rather than a statement about it.
  it('says what will appear here before the first slice does', () => {
    render(<Timeline span={SPAN} reports={[]} />)

    expect(screen.getByText(/Chaque tranche de temps explorée/)).toBeInTheDocument()
    expect(bars()).toHaveLength(0)
  })
})
