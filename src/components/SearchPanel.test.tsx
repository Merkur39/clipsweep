// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SearchPanel, type SearchPanelProps } from './SearchPanel'

afterEach(cleanup)

/**
 * The rail, never the compact shape: the two subtrees answer to the same names,
 * and rendering the flat one would put a second channel field in the document.
 * A test aiming at the narrow tiers declares `compact`.
 */
const setup = (props: Partial<SearchPanelProps> = {}) => {
  const onChannelChange = vi.fn()
  const onRememberChange = vi.fn()
  const onSinceChange = vi.fn()
  const onUntilChange = vi.fn()
  const onRun = vi.fn()
  render(
    <SearchPanel
      compact={false}
      channel="testchannel"
      onChannelChange={onChannelChange}
      remember={false}
      onRememberChange={onRememberChange}
      since="2019-01-01"
      onSinceChange={onSinceChange}
      until="2026-08-01"
      onUntilChange={onUntilChange}
      today="2026-08-01"
      periodError={null}
      channelCreatedAt={null}
      running={false}
      onRun={onRun}
      clipsFound={0}
      totalViews={0}
      coveredFrom={null}
      coveredTo={null}
      elapsedMs={null}
      verdict={{ kind: 'idle' }}
      {...props}
    />,
  )
  return { onChannelChange, onRememberChange, onSinceChange, onUntilChange, onRun }
}

const memoire = () => screen.getByRole('switch', { name: 'Se souvenir de cette chaîne' })
const lancer = () => screen.getByRole('button', { name: 'Lancer le scan' })
const chip = (name: string) => screen.getByRole('button', { name })

/** The footer's rows carry no role of their own: a name, and the figure beside it. */
const figure = (name: string) => screen.getByText(name).nextElementSibling!

describe('SearchPanel, the sweep', () => {
  // The log is folded by default: an error that appears only there is
  // impossible to find, and the click that triggers it has no visible effect.
  it('announces the period error outside the log', () => {
    setup({ periodError: 'La date de début doit précéder la date de fin.' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La date de début doit précéder la date de fin.',
    )
  })

  // Refused by `aria-disabled` and not by `disabled`, so the button keeps its
  // place in the tab order and can still say why it is unavailable. That
  // attribute prevents nothing on its own: what actually forbids the sweep is
  // the handler, so that is what the click checks.
  it('forbids the sweep while the period is inconsistent', () => {
    const { onRun } = setup({ periodError: 'peu importe' })

    expect(lancer()).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(lancer())

    expect(onRun).not.toHaveBeenCalled()
  })

  // The region stays in the document, empty: its place is reserved so the
  // message pushes nothing aside when it appears, and a screen reader announces
  // content injected into an already present live region more reliably.
  it('lets the sweep start when the period is consistent, the region staying empty', () => {
    const { onRun } = setup()

    expect(lancer()).toHaveAttribute('aria-disabled', 'false')

    fireEvent.click(lancer())

    expect(onRun).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })

  it('starts the sweep, then offers to stop it', () => {
    setup({ running: true })

    expect(screen.getByRole('button', { name: 'Arrêter le scan' })).toBeInTheDocument()
  })
})

// The name typed dies with the tab unless it is asked otherwise: the switch is
// the whole of that request, and it sits under the field it speaks about. It
// carries its own name, the caption beside it being a plain span.
describe('SearchPanel, remembering the channel', () => {
  it('offers to keep the channel, off', () => {
    setup()

    expect(memoire()).toHaveAttribute('aria-checked', 'false')
  })

  it('reports the request to keep it', () => {
    const { onRememberChange } = setup()

    fireEvent.click(memoire())

    expect(onRememberChange).toHaveBeenCalledWith(true)
  })

  it('shows the switch on for a channel already kept', () => {
    setup({ remember: true })

    expect(memoire()).toHaveAttribute('aria-checked', 'true')
  })

  it('reports the withdrawal', () => {
    const { onRememberChange } = setup({ remember: true })

    fireEvent.click(memoire())

    expect(onRememberChange).toHaveBeenCalledWith(false)
  })
})

// A preset spends no request and locks nothing: it is a shortcut for typing.
// Which means it has to write *both* bounds — a start alone would leave the end
// on whatever the field was last set to, and sweep a period nobody picked.
describe('SearchPanel, the period presets', () => {
  it('writes both dates when a preset is picked', () => {
    const { onSinceChange, onUntilChange } = setup()

    fireEvent.click(chip('30 j'))

    expect(onSinceChange).toHaveBeenCalledWith('2026-07-02')
    expect(onUntilChange).toHaveBeenCalledWith('2026-08-01')
  })

  // Pressed is read off the two fields, never remembered from a click: a period
  // reached by hand that happens to be the last thirty days lights the chip
  // that would have written it, and typing over either date releases it.
  it('presses the chip the two fields already spell out', () => {
    setup({ since: '2026-07-02', until: '2026-08-01' })

    expect(chip('30 j')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('1 an')).toHaveAttribute('aria-pressed', 'false')
  })
})

// The tally sits at the foot of the rail rather than above the table, and its
// rows are the same rows whether or not anything has been swept: they fill in.
describe('SearchPanel, the footer', () => {
  it('reports the four figures of the last sweep', () => {
    setup({
      clipsFound: 1234,
      totalViews: 56789,
      coveredFrom: '2026-07-02',
      coveredTo: '2026-08-01',
      elapsedMs: 72000,
      verdict: { kind: 'complete' },
    })

    expect(figure('Clips trouvés')).toHaveTextContent('1 234')
    expect(figure('Vues cumulées')).toHaveTextContent('56 789')
    expect(figure('Période couverte')).toHaveTextContent('02/07/2026 → 01/08/2026')
    expect(figure('Temps écoulé')).toHaveTextContent('1 min 12 s')
  })

  // `0` would be a claim; the dash is the absence of one. Each value falls back
  // on its own account — the extent is unknown until the first window closes,
  // the stopwatch until the first tick.
  it('states no figure at all before the first sweep', () => {
    setup()

    expect(figure('Clips trouvés')).toHaveTextContent('—')
    expect(figure('Vues cumulées')).toHaveTextContent('—')
    expect(figure('Période couverte')).toHaveTextContent('—')
    expect(figure('Temps écoulé')).toHaveTextContent('—')
  })

  // The heading is the only thing that moves while the sweep runs: the figures
  // on screen are this one's, not the previous one's.
  it('names the sweep in flight rather than the last one', () => {
    setup({ running: true, verdict: { kind: 'pending', done: 3, total: 8 } })

    expect(screen.getByText('Ce scan')).toBeInTheDocument()
    expect(screen.queryByText('Dernier scan')).toBeNull()
  })
})

// The one thing the sweep exists to promise, in four states — and the only
// readout with a hue of its own, carried by the variant class.
describe('SearchPanel, the verdict', () => {
  it('reports no sweep at all before the first one', () => {
    setup()

    const verdict = screen.getByText('Aucun scan lancé')

    expect(verdict).not.toHaveClass('pending')
    expect(verdict).not.toHaveClass('broken')
  })

  // A sweep in flight cannot yet answer "is the list whole?", so it counts
  // windows instead and takes the accent rather than the verdict's own hue.
  it('counts the windows swept while the sweep runs', () => {
    setup({ running: true, verdict: { kind: 'pending', done: 3, total: 8 } })

    expect(screen.getByText('3 périodes sur 8 balayées')).toHaveClass('pending')
  })

  it('promises completeness once every window has closed', () => {
    setup({ verdict: { kind: 'complete' } })

    expect(screen.getByText('Complet — aucun clip manquant')).not.toHaveClass('broken')
  })

  it('takes the red for windows whose clips are missing for good', () => {
    setup({ verdict: { kind: 'broken', lost: 3 } })

    expect(screen.getByText('Incomplet — 3 périodes perdues')).toHaveClass('broken')
  })

  // One lost window is not "1 périodes perdues": the count agrees.
  it('agrees the loss with the number of windows lost', () => {
    setup({ verdict: { kind: 'broken', lost: 1 } })

    expect(screen.getByText('Incomplet — 1 période perdue')).toBeInTheDocument()
  })
})
