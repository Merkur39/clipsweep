// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useWindowRows } from './useWindowRows'

/** The three figures, read straight off the node the hook was pointed at. */
function Harness() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollTop, viewportHeight, width } = useWindowRows(ref)

  return <div ref={ref} data-testid="rows">{`${scrollTop} ${viewportHeight} ${width}`}</div>
}

const measured = () => screen.getByTestId('rows').textContent

/**
 * jsdom lays nothing out, so every rect it hands back is a row of zeros: a test
 * about measurement has to say what the browser would have measured.
 */
const rect = (over: Partial<DOMRect>) =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...over,
  } as DOMRect)

describe('useWindowRows', () => {
  it('reads the rows off the node and the screen off the window', () => {
    // jsdom's window is 768 tall; 300 of it are spent above the rows.
    rect({ top: 300, width: 1200 })
    render(<Harness />)

    expect(measured()).toBe('0 468 1200')
  })

  it('follows the window as it scrolls', () => {
    rect({ top: 300, width: 1200 })
    render(<Harness />)

    rect({ top: -500, width: 1200 })
    act(() => window.dispatchEvent(new Event('scroll')))

    expect(measured()).toBe('500 768 1200')
  })

  /**
   * A node of no width has not been laid out — jsdom never lays anything out,
   * and a node inside something folded away measures the same zero. Taking it
   * for a measurement would collapse the board to a single column, so the last
   * real one stands.
   */
  it('holds its ground against a rect that measures nothing', () => {
    rect({ top: 300, width: 1200 })
    render(<Harness />)

    rect({ top: -500, width: 0 })
    act(() => window.dispatchEvent(new Event('scroll')))

    expect(measured()).toBe('0 468 1200')
  })

  /** Before any of that: a plausible stage rather than a blank one. */
  it('opens on a stage rather than on nothing', () => {
    render(<Harness />)

    expect(measured()).toBe('0 560 900')
  })
})
