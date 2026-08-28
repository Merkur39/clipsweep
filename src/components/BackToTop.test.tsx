// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BackToTop } from './BackToTop'

/** How far down the page the reader is, which jsdom holds but never moves. */
const scrolledTo = (scrollY: number) =>
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY })

/** A window that answers "yes" to one query, and "no" to every other. */
const refuses = (query: string) =>
  vi.stubGlobal('matchMedia', (asked: string) => ({
    matches: asked === query,
    media: asked,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

const button = () => screen.getByRole('button', { name: 'Remonter en haut' })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  scrolledTo(0)
})

describe('BackToTop', () => {
  // Nothing to go back to: at the top of the page the control would be a
  // button that does nothing, sitting over the readout to say so.
  it('is not there while the page is at its top', () => {
    render(<BackToTop />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('appears once the page has run past half a screen', () => {
    scrolledTo(window.innerHeight)

    render(<BackToTop />)

    expect(button()).toBeInTheDocument()
  })

  // Named rather than drawn: it carries an arrow and nothing else, so the name
  // is the only thing a screen reader has to go on. The tooltip says the same.
  it('names itself for the pointer as well as for the reader', () => {
    scrolledTo(window.innerHeight)

    render(<BackToTop />)

    expect(button()).toHaveAttribute('title', 'Remonter en haut')
  })

  it('brings the page back to its top', () => {
    scrolledTo(window.innerHeight)
    const scrollTo = vi.spyOn(window, 'scrollTo')

    render(<BackToTop />)
    fireEvent.click(button())

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  /**
   * A page that flies past under a reader who asked for stillness is exactly
   * what the preference is about — and it is the one animation of this control
   * the sheet cannot switch off, since it is the browser doing the scrolling.
   */
  it('goes straight there when motion is refused', () => {
    scrolledTo(window.innerHeight)
    refuses('(prefers-reduced-motion: reduce)')
    const scrollTo = vi.spyOn(window, 'scrollTo')

    render(<BackToTop />)
    fireEvent.click(button())

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })
})
