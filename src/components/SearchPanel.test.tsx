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
      channel="testchannel"
      onChannelChange={vi.fn()}
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

  // Le journal est replié par défaut : une erreur qui n'y figure que là est
  // introuvable, et le clic qui la déclenche n'a aucun effet visible.
  it('annonce l’erreur de période hors du journal', () => {
    setup({ connected: true, periodError: 'La date de début doit précéder la date de fin.' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La date de début doit précéder la date de fin.',
    )
  })

  it('interdit la fouille tant que la période est incohérente', () => {
    setup({ connected: true, periodError: 'peu importe' })

    expect(screen.getByRole('button', { name: 'Lancer la fouille' })).toBeDisabled()
  })

  // La région reste dans le document, vide : sa place est réservée pour que le
  // message n'écarte rien en apparaissant, et un lecteur d'écran annonce plus
  // fiablement un contenu injecté dans une région vive déjà là.
  it('laisse fouiller quand la période est cohérente, la région restant vide', () => {
    setup({ connected: true })

    expect(screen.getByRole('button', { name: 'Lancer la fouille' })).toBeEnabled()
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })

  it('lance la fouille, puis propose de l’arrêter', () => {
    setup({ connected: true, running: true })

    expect(screen.getByRole('button', { name: 'Arrêter la fouille' })).toBeInTheDocument()
  })
})
