// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { Door, type DoorProps } from './Door'

const setup = (props: Partial<DoorProps> = {}) => {
  const onConnect = vi.fn()
  render(
    <Door message="Déconnecté de Twitch" kind="" canConnect onConnect={onConnect} {...props} />,
  )
  return { onConnect }
}

const connexion = () => screen.getByRole('button', { name: /Se connecter/ })

/**
 * The wall, and the case for it. It is the whole screen for whoever arrives
 * without a session: everything behind it needs a Twitch quota, so there is
 * nothing to show and nothing to try first.
 */
describe('Door', () => {
  it('says what the tool is for before asking for anything', () => {
    setup()

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Tous les clips d’une chaîne.',
    )
    expect(screen.getByText(/la liste complète de ses clips/)).toBeInTheDocument()
  })

  // The one question a wall has to answer, answered where the wall stands.
  it('says why the connection is what buys the depth', () => {
    setup()

    expect(screen.getByText('Pourquoi se connecter ?')).toBeInTheDocument()
    expect(screen.getByText(/ton propre quota/)).toBeInTheDocument()
  })

  it('offers to connect, and reports it', () => {
    const { onConnect } = setup()

    fireEvent.click(connexion())

    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  // Without a Client ID no connection is possible: the button stays visible so
  // that the configuration message has a subject, but inert.
  it('disables connecting for lack of a configured application', () => {
    setup({ canConnect: false })

    expect(connexion()).toBeDisabled()
  })

  /**
   * What is being asked for, in the words of what is not: an OAuth screen names
   * scopes, and a visitor who has just read "no permission requested" can check
   * it against what Twitch then shows them.
   */
  it('states what the connection does not ask for', () => {
    setup()

    expect(screen.getByText('Aucune permission demandée')).toBeInTheDocument()
    expect(screen.getByText('Aucune info personnelle')).toBeInTheDocument()
  })

  it('states a refusal, which is the one access message worth reading here', () => {
    setup({ message: 'Twitch a refusé la connexion : access_denied', kind: 'bad' })

    expect(screen.getByText('Twitch a refusé la connexion : access_denied')).toBeInTheDocument()
  })

  // "Disconnected" is what the whole screen already says.
  it('says nothing of being merely disconnected', () => {
    setup({ message: 'Déconnecté de Twitch', kind: '' })

    expect(screen.queryByText('Déconnecté de Twitch')).toBeNull()
  })
})
