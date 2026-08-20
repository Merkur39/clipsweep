// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SearchPanel, type SearchPanelProps } from './SearchPanel'

afterEach(cleanup)

const setup = (props: Partial<SearchPanelProps> = {}) => {
  const onRememberChange = vi.fn()
  const onConnect = vi.fn()
  render(
    <SearchPanel
      channel="testchannel"
      onChannelChange={vi.fn()}
      remember={false}
      onRememberChange={onRememberChange}
      since="2019-01-01"
      onSinceChange={vi.fn()}
      until="2026-08-01"
      onUntilChange={vi.fn()}
      today="2026-08-01"
      periodError={null}
      channelCreatedAt={null}
      connected
      canConnect
      onConnect={onConnect}
      running={false}
      onRun={vi.fn()}
      {...props}
    />,
  )
  return { onRememberChange, onConnect }
}

const memoire = () => screen.getByRole('checkbox', { name: 'Se souvenir de cette chaîne' })

describe('SearchPanel, the period', () => {
  // The log is folded by default: an error that appears only there is
  // impossible to find, and the click that triggers it has no visible effect.
  it('announces the period error outside the log', () => {
    setup({ connected: true, periodError: 'La date de début doit précéder la date de fin.' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La date de début doit précéder la date de fin.',
    )
  })

  it('forbids the sweep while the period is inconsistent', () => {
    setup({ connected: true, periodError: 'peu importe' })

    expect(screen.getByRole('button', { name: 'Lancer le scan' })).toBeDisabled()
  })

  // The region stays in the document, empty: its place is reserved so the
  // message pushes nothing aside when it appears, and a screen reader announces
  // content injected into an already present live region more reliably.
  it('lets the sweep start when the period is consistent, the region staying empty', () => {
    setup({ connected: true })

    expect(screen.getByRole('button', { name: 'Lancer le scan' })).toBeEnabled()
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })

  it('starts the sweep, then offers to stop it', () => {
    setup({ connected: true, running: true })

    expect(screen.getByRole('button', { name: 'Arrêter le scan' })).toBeInTheDocument()
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

// What a visitor meets before there is any session. "Connect to Twitch" alone
// asks someone who has never heard of the tool to hand over an account without
// saying what that buys or what it costs; the tokens carry no scope at all,
// which is the one fact worth stating before the click.
describe('SearchPanel, before any session', () => {
  const promise = /aucune permission sur ton compte/

  it('says what connecting grants, and what it does not', () => {
    setup({ connected: false })

    expect(screen.getByText(promise)).toBeInTheDocument()
  })

  // Afterwards it is noise: the question it answers has been settled.
  it('drops the explanation once connected', () => {
    setup({ connected: true })

    expect(screen.queryByText(promise)).toBeNull()
  })
})

// The one thing to do when there is no session, and it sits on the row the eye
// is already on rather than in a corner of the top bar.
describe('SearchPanel, connecting', () => {
  const connexion = () => screen.queryByRole('button', { name: 'Se connecter à Twitch' })

  it('offers to connect instead of to start', () => {
    setup({ connected: false })

    expect(connexion()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lancer le scan' })).toBeNull()
  })

  it('reports the connection request', () => {
    const { onConnect } = setup({ connected: false })

    fireEvent.click(connexion()!)

    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  // Sans Client ID, aucune connexion n'est possible : le bouton reste visible
  // pour que le message de configuration ait un sujet, mais inerte.
  it('disables connecting for lack of a configured application', () => {
    setup({ connected: false, canConnect: false })

    expect(connexion()).toBeDisabled()
  })
})

// The creation date stays true once the session ends — it is a fact about the
// channel, not about the visitor. What stops being true is the offer built on
// it: widening the period is something only a session can act on.
describe('SearchPanel, reaching back to the channel’s creation', () => {
  const remonter = () => screen.queryByRole('button', { name: /Remonter à la création/ })

  it('offers the jump when the channel predates the period asked for', () => {
    setup({ connected: true, channelCreatedAt: '2017-07-10', since: '2019-01-01' })

    expect(remonter()).toBeInTheDocument()
  })

  it('withdraws the offer once there is no session to act on it', () => {
    setup({ connected: false, channelCreatedAt: '2017-07-10', since: '2019-01-01' })

    expect(remonter()).toBeNull()
  })
})
