// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { Account, type AccountProps } from './Account'

const setup = (props: Partial<AccountProps> = {}) => {
  const onConnect = vi.fn()
  const onDisconnect = vi.fn()
  render(
    <Account
      message="peu importe"
      kind=""
      connected={false}
      canConnect
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      {...props}
    />,
  )
  return { onConnect, onDisconnect }
}

const connexion = () => screen.queryByRole('button', { name: 'Se connecter avec Twitch' })
const deconnexion = () => screen.queryByRole('button', { name: 'Se déconnecter' })

/**
 * The account belongs to the nameplate, not to the query: who you are outlives
 * every search of the session, where the ticket empties and refills with each
 * one. It is also what the login screen leaves behind once it has been passed.
 */
describe('Account', () => {
  it('states where the access stands', () => {
    setup({ message: 'Connecté', kind: 'ok' })

    expect(screen.getByText('Connecté')).toBeInTheDocument()
  })

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

  it('reports the connect request', () => {
    const { onConnect } = setup()

    fireEvent.click(connexion()!)

    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  // Without a Client ID no connection is possible: the button stays visible so
  // that the configuration message has a subject, but inert.
  it('disables connecting for lack of a configured application', () => {
    setup({ canConnect: false })

    expect(connexion()).toBeDisabled()
  })
})
