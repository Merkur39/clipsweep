// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it } from 'vitest'

import { SearchRun, type SearchRunProps } from './SearchRun'

const base = {
  windowsDone: 47,
  windowsTotal: 96,
  coveredMs: 47,
  periodMs: 96,
  clipsFound: 3218,
  requests: 640,
  pass: 'wide' as const,
  passDone: 0,
  passTotal: null,
  stalePages: 0,
}

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
        pass: 'wide' as const,
        passDone: 0,
        passTotal: null,
        stalePages: 0,
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

  /**
   * The second pass costs nine requests out of ten and brings back next to
   * nothing — 0 clips of 261 on `vinc33x`, 1 of 91 on `noxya__`, measured on
   * 2026-09-21. The table is there by then, so the block comes down to a line
   * at the foot of the screen and lets it be read.
   */
  it('comes down to a line while the second pass verifies', () => {
    const { container } = setup({
      progress: {
        windowsDone: 0,
        windowsTotal: 1,
        coveredMs: 0,
        periodMs: 172_800_000,
        clipsFound: 261,
        requests: 57,
        pass: 'narrow',
        passDone: 43,
        passTotal: 100,
        stalePages: 0,
      },
    })

    expect(container.firstElementChild!).toHaveAttribute('data-compact')
    expect(screen.getByText(/Vérification en cours/)).toBeInTheDocument()
    // The figure goes with it: the ticket above carries the same count, in the
    // same words, three centimetres higher. One readout of one number.
    expect(container.querySelector('.run-count')).toBeNull()
    expect(screen.queryByText(/261/)).toBeNull()
    // The slice count and the estimate go back down to the drawer: over a
    // single window they read "0 of 1" and divide by ground that cannot move.
    expect(container.querySelector('.run-foot')).toBeNull()
  })

  /**
   * And it is the one stretch that can be drawn as a fraction. `coveredMs` only
   * moves when a window closes, so over the single window a sweep now seeds, the
   * bar has nothing to say from the first request to the last — where the pass
   * knows exactly what it costs.
   */
  it('draws the second pass as a fraction of itself', () => {
    setup({
      progress: {
        windowsDone: 0,
        windowsTotal: 1,
        coveredMs: 0,
        periodMs: 172_800_000,
        clipsFound: 261,
        requests: 57,
        pass: 'narrow',
        passDone: 43,
        passTotal: 100,
        stalePages: 0,
      },
    })
    const bar = screen.getByRole('progressbar')

    expect(bar).not.toHaveAttribute('data-indeterminate')
    expect(bar).toHaveAttribute('aria-valuenow', '43')
  })

  it('stays whole while the first pass walks', () => {
    const { container } = setup()

    expect(container.firstElementChild!).not.toHaveAttribute('data-compact')
    expect(container.querySelector('.run-foot')).not.toBeNull()
  })

  it('opens the moment a search is running', () => {
    const { container } = setup()
    const slot = container.firstElementChild!

    expect(slot).toHaveAttribute('data-open')
    expect(slot).not.toHaveAttribute('inert')
  })

  /**
   * A halved slice re-reads the top of its parent's span, so the count stands
   * perfectly still while the requests carry on — measured at 48 % of the wide
   * pass, in nine stretches, two of them under three seconds.
   *
   * Said beside the count and not in place of it. The count is still true, and
   * it is the still number that raises the question, so the answer belongs next
   * to it; taking the figure off screen and putting it back nine times a search
   * answers a stall with a flicker.
   */
  it('says why the count is standing still, beside the count', () => {
    setup({ progress: { ...base, stalePages: 2 } })

    expect(screen.getByText('3 218')).toBeInTheDocument()
    expect(screen.getByText(/clips trouvés — En attente de Twitch/)).toBeInTheDocument()
  })

  // One page adding nothing is ordinary — a page of twenty against a catalogue
  // of thousands often lands entirely inside what is held. A run of two is the
  // overlap, and the line would otherwise blink on and off through the search.
  it('says nothing when a single page merely added nothing', () => {
    setup({ progress: { ...base, stalePages: 1 } })

    expect(screen.getByText('clips trouvés')).toBeInTheDocument()
    expect(screen.queryByText(/En attente de Twitch/)).not.toBeInTheDocument()
  })

  /**
   * A rate-limit pause can land inside one of these stretches — the two are
   * independent — and both would then say Twitch is holding things up, two
   * lines apart. Only one of them is a delay Twitch is imposing, with a
   * countdown and a promise to resume; the other waits on nothing. So the
   * suffix gives the word back, and the pause keeps the signal it was written
   * for.
   */
  it('gives the word back to a pause that lands mid-stretch', () => {
    setup({ progress: { ...base, stalePages: 2 }, pausedUntil: Date.now() + 12_000 })

    expect(screen.getByText(/Twitch demande une pause/)).toBeInTheDocument()
    expect(screen.queryByText(/clips trouvés — En attente de Twitch/)).not.toBeInTheDocument()
    expect(screen.getByText('clips trouvés')).toBeInTheDocument()
  })

  it('stops claiming a share it cannot move', () => {
    const { container } = setup({ progress: { ...base, stalePages: 2 } })

    expect(container.querySelector('.run-bar')).toHaveAttribute('data-indeterminate')
  })

  // Verifying already has its own line and shows no figure at all, and the
  // narrow pass leaves the counter at nought: it must not speak over it.
  it('says it is verifying rather than re-reading', () => {
    setup({ progress: { ...base, pass: 'narrow', passTotal: 10, passDone: 3, stalePages: 2 } })

    expect(screen.getByText('Vérification en cours…')).toBeInTheDocument()
    expect(screen.queryByText(/En attente de Twitch/)).not.toBeInTheDocument()
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
        pass: 'wide' as const,
        passDone: 0,
        passTotal: null,
        stalePages: 0,
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
        pass: 'wide' as const,
        passDone: 0,
        passTotal: null,
        stalePages: 0,
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
        pass: 'wide' as const,
        passDone: 0,
        passTotal: null,
        stalePages: 0,
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
