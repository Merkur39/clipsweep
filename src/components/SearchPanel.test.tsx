// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SearchPanel, type SearchPanelProps } from './SearchPanel'

afterEach(cleanup)

const setup = (props: Partial<SearchPanelProps> = {}) => {
  const onConnect = vi.fn()
  const onDisconnect = vi.fn()
  render(
    <SearchPanel
      authMessage="peu importe"
      authKind=""
      connected={false}
      canConnect
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      channel="kaliyami"
      onChannelChange={vi.fn()}
      since="2019-01-01"
      onSinceChange={vi.fn()}
      until="2026-08-01"
      onUntilChange={vi.fn()}
      today="2026-08-01"
      channelCreatedAt={null}
      running={false}
      onRun={vi.fn()}
      {...props}
    />,
  )
  return { onConnect, onDisconnect }
}

const connexion = () => screen.queryByRole('button', { name: 'Se connecter à Twitch' })
const deconnexion = () => screen.queryByRole('button', { name: 'Se déconnecter' })

describe('SearchPanel, accès', () => {
  it('propose de se connecter tant qu’on ne l’est pas', () => {
    setup()

    expect(connexion()).toBeInTheDocument()
    expect(deconnexion()).toBeNull()
  })

  // Un bouton désactivé qui répète la ligne d'état n'est pas un contrôle :
  // une fois connecté, la seule action qui reste est de partir.
  it('propose de se déconnecter une fois connecté', () => {
    setup({ connected: true })

    expect(deconnexion()).toBeInTheDocument()
    expect(connexion()).toBeNull()
  })

  it('remonte la demande de déconnexion', () => {
    const { onDisconnect } = setup({ connected: true })

    fireEvent.click(deconnexion()!)

    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  // Sans Client ID, aucune connexion n'est possible : le bouton reste visible
  // pour que le message de configuration ait un sujet, mais inerte.
  it('désactive la connexion faute d’application configurée', () => {
    setup({ canConnect: false })

    expect(connexion()).toBeDisabled()
  })

  it('lance la fouille, puis propose de l’arrêter', () => {
    setup({ connected: true, running: true })

    expect(screen.getByRole('button', { name: 'Arrêter la fouille' })).toBeInTheDocument()
  })
})
