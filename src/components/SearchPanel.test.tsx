// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SearchPanel, type SearchPanelProps } from './SearchPanel'

afterEach(cleanup)

const setup = (props: Partial<SearchPanelProps> = {}) => {
  const onConnect = vi.fn()
  const onDisconnect = vi.fn()
  const onRememberChange = vi.fn()
  render(
    <SearchPanel
      authMessage="peu importe"
      authKind=""
      connected={false}
      canConnect
      onConnect={onConnect}
      onDisconnect={onDisconnect}
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
      running={false}
      onRun={vi.fn()}
      {...props}
    />,
  )
  return { onConnect, onDisconnect, onRememberChange }
}

const connexion = () => screen.queryByRole('button', { name: 'Se connecter à Twitch' })
const deconnexion = () => screen.queryByRole('button', { name: 'Se déconnecter' })
const memoire = () => screen.getByRole('checkbox', { name: 'Se souvenir de cette chaîne' })

describe('SearchPanel, access', () => {
  it('offers to connect while you are not', () => {
    setup()

    expect(connexion()).toBeInTheDocument()
    expect(deconnexion()).toBeNull()
  })

  // A disabled button repeating the status line is not a control: once
  // connected, the only action left is leaving.
  it('offers to disconnect once connected', () => {
    setup({ connected: true })

    expect(deconnexion()).toBeInTheDocument()
    expect(connexion()).toBeNull()
  })

  it('reports the disconnect request', () => {
    const { onDisconnect } = setup({ connected: true })

    fireEvent.click(deconnexion()!)

    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  // Sans Client ID, aucune connexion n'est possible : le bouton reste visible
  // pour que le message de configuration ait un sujet, mais inerte.
  it('disables connecting for lack of a configured application', () => {
    setup({ canConnect: false })

    expect(connexion()).toBeDisabled()
  })

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
