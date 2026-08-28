// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { SearchPanel, type SearchPanelProps } from './SearchPanel'

const setup = (props: Partial<SearchPanelProps> = {}) => {
  const onChannelChange = vi.fn()
  const onRememberChange = vi.fn()
  const onPeriodChange = vi.fn()
  const onSinceChange = vi.fn()
  const onUntilChange = vi.fn()
  const onRun = vi.fn()
  render(
    <SearchPanel
      channel="testchannel"
      onChannelChange={onChannelChange}
      lastChannel=""
      remember={false}
      onRememberChange={onRememberChange}
      since="2019-01-01"
      onSinceChange={onSinceChange}
      until="2026-08-27"
      onUntilChange={onUntilChange}
      onPeriodChange={onPeriodChange}
      today="2026-08-27"
      periodError={null}
      channelCreatedAt={null}
      channelStatus="found"
      running={false}
      onRun={onRun}
      {...props}
    />,
  )
  return { onChannelChange, onRememberChange, onPeriodChange, onSinceChange, onUntilChange, onRun }
}

const field = (label: string) => screen.getByLabelText(label, { selector: 'input' })
const preset = (name: string) => screen.getByRole('button', { name })
const memoire = () => screen.getByRole('checkbox', { name: 'Se souvenir de cette chaîne' })
const editDates = () => screen.getByRole('button', { name: 'Modifier les dates' })

/**
 * The channel is the one thing the reader has to type, so it is drawn as the one
 * thing on screen: full width, at the size of a title, and prefixed by the
 * address it completes — which is also what says which name is being asked for.
 */
describe('SearchPanel, the channel', () => {
  it('completes the address rather than asking for a word', () => {
    setup()

    expect(screen.getByText('twitch.tv/')).toBeInTheDocument()
  })

  it('reports what is typed', () => {
    const { onChannelChange } = setup()

    fireEvent.change(field('Chaîne'), { target: { value: 'kaliyami' } })

    expect(onChannelChange).toHaveBeenCalledWith('kaliyami')
  })
})

/**
 * Three shortcuts, and the two date fields behind them. A period is chosen from
 * a shortcut nineteen times out of twenty; the fields answer the twentieth, and
 * cost nothing until then.
 */
describe('SearchPanel, the period', () => {
  it('offers the three shortcuts', () => {
    setup()

    expect(preset('30 derniers jours')).toBeInTheDocument()
    expect(preset('12 derniers mois')).toBeInTheDocument()
    expect(preset('Depuis le début')).toBeInTheDocument()
  })

  // Read off the two bounds, not remembered from the last click: a reload
  // brings the bounds back from `sessionStorage`, and the click does not.
  it('lights the shortcut the period is on', () => {
    setup({ since: '2025-08-27', until: '2026-08-27' })

    expect(preset('12 derniers mois')).toHaveAttribute('aria-pressed', 'true')
    expect(preset('30 derniers jours')).toHaveAttribute('aria-pressed', 'false')
  })

  it('lights none for a period typed by hand', () => {
    setup({ since: '2026-01-01', until: '2026-08-27' })

    for (const name of ['30 derniers jours', '12 derniers mois', 'Depuis le début']) {
      expect(preset(name)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  // Both bounds in one call: a shortcut sets a period, and two separate reports
  // would let a render see a start without its end.
  it('sets the whole period at one go', () => {
    const { onPeriodChange } = setup()

    fireEvent.click(preset('30 derniers jours'))

    expect(onPeriodChange).toHaveBeenCalledWith({ since: '2026-07-28', until: '2026-08-27' })
  })

  it('searches the channel from its creation when "since the beginning" is asked for', () => {
    const { onPeriodChange } = setup({ channelCreatedAt: '2019-04-11' })

    fireEvent.click(preset('Depuis le début'))

    expect(onPeriodChange).toHaveBeenCalledWith({ since: '2019-04-11', until: '2026-08-27' })
  })

  it('spells out the period the shortcuts resolve to', () => {
    setup({ since: '2026-07-28', until: '2026-08-27' })

    expect(screen.getByText('du 28/07/2026 au 27/08/2026')).toBeInTheDocument()
  })

  it('keeps the two date fields behind the shortcuts', () => {
    setup()

    expect(screen.queryByLabelText('Depuis', { selector: 'input' })).toBeNull()
  })

  it('opens them on request', () => {
    setup()

    fireEvent.click(editDates())

    expect(field('Depuis')).toHaveValue('2019-01-01')
    expect(field('Jusqu’au')).toHaveValue('2026-08-27')
  })

  /**
   * A period can only be inconsistent by hand — but the bounds outlive the tab,
   * and a reload brings the fault back with the fields shut. The run button
   * would then be disabled with its cause folded away.
   */
  it('opens them by itself when the period is at fault', () => {
    setup({ periodError: 'peu importe', since: '2026-08-28' })

    expect(field('Depuis')).toBeInTheDocument()
  })

  // The log is folded by default: an error that appears only there is
  // impossible to find, and the click that triggers it has no visible effect.
  it('announces the period error outside the log', () => {
    setup({
      periodError: 'La date de fin est avant la date de début. Inverse les deux.',
    })

    expect(screen.getAllByRole('alert')[1]).toHaveTextContent(
      'La date de fin est avant la date de début. Inverse les deux.',
    )
  })

  it('forbids the search while the period is inconsistent', () => {
    setup({ periodError: 'peu importe' })

    expect(screen.getByRole('button', { name: 'Chercher les clips' })).toBeDisabled()
  })

  /**
   * The region stays in the document, empty, for as long as the fields it
   * belongs to are open: its place is reserved so the message pushes nothing
   * aside when it appears, and a screen reader announces content injected into
   * an already present live region more reliably than one that arrives with it.
   */
  it('lets the search start when the period is consistent, the region staying empty', () => {
    setup()
    fireEvent.click(editDates())

    expect(screen.getByRole('button', { name: 'Chercher les clips' })).toBeEnabled()
    expect(screen.getAllByRole('alert')[1]).toBeEmptyDOMElement()
  })
})

const run = () => screen.getByRole('button', { name: 'Chercher les clips' })

/**
 * A search commits minutes and a slice of a quota, so it starts on a channel
 * that is **known to exist** and on nothing else. Every other state of the
 * lookup — nothing typed, still checking, no such channel, the check itself not
 * made — leaves the button shut.
 *
 * Which means it never comes alive mid-word: it waits for the answer rather
 * than following the keystrokes.
 */
describe('SearchPanel, what the button refuses', () => {
  it('opens only on a channel that is confirmed to exist', () => {
    setup({ channel: 'kaliyami', channelStatus: 'found' })

    expect(run()).toBeEnabled()
  })

  it('refuses an empty field', () => {
    setup({ channel: '', channelStatus: 'blank' })

    expect(run()).toBeDisabled()
  })

  it('refuses a channel Twitch says does not exist', () => {
    setup({ channel: 'nexistepas', channelStatus: 'missing' })

    expect(run()).toBeDisabled()
  })

  // Disabled with its cause out of sight is what makes a control unusable: the
  // reason stands under the field it is about.
  it('says why, under the field it is about', () => {
    setup({ channel: 'nexistepas', channelStatus: 'missing' })

    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Cette chaîne n’existe pas.')
  })

  /**
   * The field carries the fault as well as the line under it. Colour alone
   * would say nothing to a screen reader, and a message alone leaves the field
   * looking untouched — `aria-invalid` is what ties the two together, and
   * `aria-describedby` is what makes the reason read out with the field rather
   * than as a stray sentence somewhere below it.
   */
  it('marks the field itself at fault, and points at the reason', () => {
    setup({ channel: 'nexistepas', channelStatus: 'missing' })
    const input = field('Chaîne')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByRole('alert')[0]).toHaveAttribute(
      'id',
      input.getAttribute('aria-describedby'),
    )
  })

  it('leaves the field unmarked while nothing is wrong with it', () => {
    setup({ channel: 'kaliyami', channelStatus: 'found' })
    const input = field('Chaîne')

    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  /**
   * The point of the whole thing: a name half typed is a name that has not been
   * confirmed, so the button does not follow the keystrokes into life and back
   * out of it. It says nothing while it waits, though — a line appearing and
   * clearing every half-second, on a field being typed into, would be the noise
   * the fold was drawn to avoid.
   */
  it('stays shut while the channel is still being checked', () => {
    setup({ channel: 'kaliyami', channelStatus: 'checking' })

    expect(run()).toBeDisabled()
    expect(screen.getAllByRole('alert')[0]).toBeEmptyDOMElement()
  })

  /* Nothing was confirmed, so nothing is offered. It is also the honest answer:
     a search needs the very endpoint the check could not reach. */
  it('stays shut when the check itself could not be made', () => {
    setup({ channel: 'kaliyami', channelStatus: 'unreachable' })

    expect(run()).toBeDisabled()
  })

  /**
   * While a search runs, this button is the way out of it. Every refusal above
   * is about starting one — applied to stopping, they would strand a reader in
   * front of a search they cannot end by clearing the field.
   */
  it('never refuses the way out of a running search', () => {
    setup({ channel: '', channelStatus: 'missing', periodError: 'peu importe', running: true })

    expect(screen.getByRole('button', { name: 'Arrêter la recherche' })).toBeEnabled()
  })
})

/**
 * The channel of the last search of this session, offered back as a chip. Its
 * whole job is the second search: the field holds what is being typed now, and
 * one click brings back what was searched a minute ago.
 */
describe('SearchPanel, the last channel searched', () => {
  it('offers it back when the field has moved on', () => {
    setup({ channel: 'zerator', lastChannel: 'kaliyami' })

    expect(screen.getByRole('button', { name: 'kaliyami' })).toBeInTheDocument()
  })

  it('fills the field with it', () => {
    const { onChannelChange } = setup({ channel: 'zerator', lastChannel: 'kaliyami' })

    fireEvent.click(screen.getByRole('button', { name: 'kaliyami' }))

    expect(onChannelChange).toHaveBeenCalledWith('kaliyami')
  })

  // Offering a name the field already holds is offering nothing.
  it('says nothing while the field already holds it', () => {
    setup({ channel: 'kaliyami', lastChannel: 'kaliyami' })

    expect(screen.queryByRole('button', { name: 'kaliyami' })).toBeNull()
  })

  it('says nothing before the first search of the session', () => {
    setup({ lastChannel: '' })

    expect(screen.queryByRole('button', { name: 'kaliyami' })).toBeNull()
  })
})

// The name typed dies with the tab unless it is asked otherwise: the box is the
// whole of that request, and it sits under the field it speaks about.
describe('SearchPanel, remembering the channel', () => {
  it('offers to keep the channel, unticked', () => {
    setup()

    expect(memoire()).not.toBeChecked()
  })

  it('reports the request to keep it', () => {
    const { onRememberChange } = setup()

    fireEvent.click(memoire())

    expect(onRememberChange).toHaveBeenCalledWith(true)
  })

  it('shows the box ticked for a channel already kept', () => {
    setup({ remember: true })

    expect(memoire()).toBeChecked()
  })

  it('reports the withdrawal', () => {
    const { onRememberChange } = setup({ remember: true })

    fireEvent.click(memoire())

    expect(onRememberChange).toHaveBeenCalledWith(false)
  })
})

/**
 * The way back out of the reopened ticket.
 *
 * It hangs entirely from `onFold`: before the first search the ticket is the
 * whole screen, and a control that folded it would fold it onto nothing. Once
 * something has been found, reopening the form is a look rather than a
 * commitment — and a look one must be able to leave without spending a search
 * to do it.
 */
describe('SearchPanel, the way back', () => {
  const back = () => screen.queryByRole('button', { name: 'Revenir aux résultats' })

  it('offers none before anything has been searched', () => {
    setup()

    expect(back()).toBeNull()
  })

  it('folds on the corner button', () => {
    const onFold = vi.fn()
    setup({ onFold })

    fireEvent.click(back()!)

    expect(onFold).toHaveBeenCalled()
  })

  /* The way out of anything that hangs open, and the one nobody has to be told
     about: the same key that dismisses every panel of the toolbar. */
  it('folds on the escape key', () => {
    const onFold = vi.fn()
    setup({ onFold })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onFold).toHaveBeenCalled()
  })

  /* Fired from the field rather than at the document, because that is where the
     caret is when a reader gives up on a name half typed. A bare key is inert
     inside an input everywhere else in this application — see `useHotkey` — and
     the escape key is the exception that has to be stated. */
  it('answers from the field the caret is in', () => {
    const onFold = vi.fn()
    setup({ onFold })

    fireEvent.keyDown(field('Chaîne'), { key: 'Escape' })

    expect(onFold).toHaveBeenCalled()
  })

  /* The listener outlives nothing: it is put down with the panel. Left behind,
     it would fold a ticket that is already folded on every press for the rest
     of the session. */
  it('stops answering once the panel is gone', () => {
    const onFold = vi.fn()
    setup({ onFold })
    cleanup()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onFold).not.toHaveBeenCalled()
  })

  /* A modal standing over the page owns that key while it is up: `<dialog>`
     closes itself on the press, and the ticket underneath must not fold with
     it — the reader asked for one thing to close, not two. */
  it('yields the key to a dialog standing over it', () => {
    const onFold = vi.fn()
    setup({ onFold })
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)

    try {
      fireEvent.keyDown(document, { key: 'Escape' })
    } finally {
      // Before the assertion: a failure here would otherwise leave an open
      // dialog standing over every test that follows in this file.
      dialog.remove()
    }

    expect(onFold).not.toHaveBeenCalled()
  })

  /* First in the DOM as it is first in the corner, like the player's: the way
     out is the one control that must be reachable without reading anything. */
  it('places the way out ahead of the field it stands over', () => {
    setup({ onFold: vi.fn() })

    expect(back()!.compareDocumentPosition(field('Chaîne'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
