// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it } from 'vitest'

import { SearchRun, type SearchRunProps } from './SearchRun'

const setup = (props: Partial<SearchRunProps> = {}) =>
  render(
    <SearchRun
      progress={{
        windowsDone: 47,
        windowsTotal: 96,
        // Just under half the period behind it, which the 47 slices agree with.
        coveredMs: 47,
        periodMs: 96,
        clipsFound: 3218,
        requests: 640,
      }}
      pausedUntil={null}
      clipsFound={3218}
      running
      // Two minutes in, which is what the estimate extrapolates from.
      elapsedMs={120_000}
      {...props}
    />,
  )

/**
 * A search runs for minutes. What it says while it runs is the whole of what
 * stands between "it is working" and "it has hung", so it is drawn as the
 * subject of the screen rather than as a line above a table.
 */
describe('SearchRun', () => {
  /**
   * It stays in the page so it can fold away rather than vanish — a block of
   * 150px leaving the flow between one frame and the next takes the toolbar and
   * the first rows of the readout up with it. Folded, it is `inert`: no tab
   * stop, and nothing for a screen reader to recite about a search that is
   * over.
   */
  it('folds away rather than saying nothing at all', () => {
    const { container } = setup({ running: false })
    const slot = container.firstElementChild!

    expect(slot).not.toHaveAttribute('data-open')
    expect(slot).toHaveAttribute('inert')
  })

  it('opens the moment a search is running', () => {
    const { container } = setup()
    const slot = container.firstElementChild!

    expect(slot).toHaveAttribute('data-open')
    expect(slot).not.toHaveAttribute('inert')
  })

  it('leads with what has been found so far', () => {
    setup({ clipsFound: 3218 })

    expect(screen.getByText('3 218')).toBeInTheDocument()
    expect(screen.getByText('clips trouvés')).toBeInTheDocument()
  })

  /**
   * It says that a search is under way, and nothing else. It used to name the
   * channel — but the ticket names it, three centimetres above and permanently,
   * and this line is displaced by the pause countdown the moment there is
   * something worth reading here.
   */
  it('says a search is under way', () => {
    setup()

    expect(screen.getByText('Recherche en cours…')).toBeInTheDocument()
  })

  it('states the slices behind it and what is left', () => {
    setup()

    expect(screen.getByText(/47 tranches sur 96/)).toBeInTheDocument()
    expect(screen.getByText(/environ 2 min restantes/)).toBeInTheDocument()
  })

  /**
   * The bar is filled by the period behind the search, not by the slices behind
   * it. The slice count is a fraction whose denominator GROWS — every saturated
   * window is halved into two more — and past the halfway mark it therefore
   * shrinks: `(d + 1) / (T + 2) < d / T` whenever `T < 2d`. The bar slid
   * backwards, with a 240ms transition on it, at every split of a dense year.
   *
   * The period cannot do that: halves tile their parent exactly, so a split
   * moves no ground rather than negative ground.
   */
  it('fills the bar by the period covered, not by the slice count', () => {
    // Three slices of eight are behind it, and one of them was halved rather
    // than walked: three quarters of the period, not three eighths.
    const { container } = setup({
      progress: {
        windowsDone: 3,
        windowsTotal: 8,
        coveredMs: 750,
        periodMs: 1000,
        clipsFound: 12,
        requests: 30,
      },
    })

    expect(container.querySelector('.run-bar i')).toHaveStyle({ inlineSize: '75%' })
  })

  /**
   * The scale it is announced on is fixed at a hundred, where the slice total
   * moved under the listener at every split — a progress bar whose maximum
   * changes is one that has to be re-learnt to be read.
   */
  it('reports where it stands to assistive technology', () => {
    setup()

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '49')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).not.toHaveAttribute('data-indeterminate')
  })

  /**
   * Before the first slice comes back there is no fraction to draw, and a bar
   * drawn at zero is a bar that looks broken — the sheen that says "alive"
   * lives inside the filled part, which is nought pixels wide for exactly as
   * long as it is the only thing saying it. So the bar declares itself
   * indeterminate instead, in the DOM and to assistive technology alike.
   */
  it('stays indeterminate until a slice has actually come back', () => {
    setup({
      progress: {
        windowsDone: 0,
        windowsTotal: 11,
        coveredMs: 0,
        periodMs: 99,
        clipsFound: 0,
        requests: 3,
      },
      clipsFound: 0,
    })

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('data-indeterminate')
    expect(bar).not.toHaveAttribute('aria-valuenow')
  })

  /**
   * The first slice of all can be the one that saturates, and a slice that gets
   * halved covers no ground. Read off the slice count the bar would go
   * determinate and draw a fraction of nothing; read off the period it stays
   * where it belongs, which is the same measure the fill uses — so the hatch
   * and the sheen can never be on screen at once.
   */
  it('stays indeterminate through a first slice that only got halved', () => {
    setup({
      progress: {
        windowsDone: 1,
        windowsTotal: 3,
        coveredMs: 0,
        periodMs: 99,
        clipsFound: 40,
        requests: 10,
      },
      clipsFound: 40,
    })

    expect(screen.getByRole('progressbar')).toHaveAttribute('data-indeterminate')
  })

  // The longest stretch of all: the channel is still being resolved, so there
  // is not even a slice count to divide by.
  it('stays indeterminate while the search has reported nothing at all', () => {
    setup({ progress: null, clipsFound: 0 })

    expect(screen.getByRole('progressbar')).toHaveAttribute('data-indeterminate')
  })

  // An indeterminate bar animates. A search that is over animates nothing —
  // least of all behind a block the fold has already taken down to no height.
  it('drops the indeterminate state with the search that was running', () => {
    setup({ running: false, progress: null, clipsFound: 0 })

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('data-indeterminate')
  })

  /**
   * Twitch answers 429 when the minute's requests run out, and the client waits
   * it out — for up to a minute. Said nothing about, the search simply stops
   * moving, and the only reading left is that it has hung.
   */
  it('says the pause Twitch is asking for, in place of what it was doing', () => {
    setup({ pausedUntil: Date.now() + 34_000 })

    expect(screen.getByText(/pause de 34 secondes/)).toBeInTheDocument()
    expect(screen.queryByText(/On fouille/)).toBeNull()
  })

  /**
   * The longest silence of all: a 429 on the very first request leaves the
   * search with no progress to report, so anything guarded on progress says
   * nothing at all — for up to a minute, with a "stop" button and no reason for
   * it on screen.
   */
  it('says the pause before the first slice has reported anything', () => {
    setup({ progress: null, clipsFound: 0, pausedUntil: Date.now() + 20_000 })

    expect(screen.getByText(/pause de 20 secondes/)).toBeInTheDocument()
  })

  // An invitation to sort what is not there yet is an invitation to use a
  // toolbar that acts on nothing.
  it('waits for something to sort before saying it can be sorted', () => {
    setup({ progress: null, clipsFound: 0 })

    expect(screen.queryByText('Les résultats sont déjà triables.')).toBeNull()
  })

  /**
   * A pause outlives nothing: it is read from a search that is running. Now
   * that the block folds instead of unmounting, the countdown is what has to
   * refuse it — an unmounted block refused it by accident.
   */
  it('ignores a pause left behind by a search that is over', () => {
    setup({ running: false, pausedUntil: Date.now() + 20_000 })

    expect(screen.queryByText(/pause de/)).toBeNull()
  })
})
