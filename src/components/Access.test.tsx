// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Access, type AccessProps } from './Access'

afterEach(cleanup)

const setup = (props: Partial<AccessProps> = {}) => {
  const onDisconnect = vi.fn()
  render(
    <Access
      message="peu importe"
      kind=""
      connected={false}
      onDisconnect={onDisconnect}
      {...props}
    />,
  )
  return { onDisconnect }
}

const deconnexion = () => screen.queryByRole('button', { name: 'Se déconnecter' })

describe('Access', () => {
  // The way in is not here: it lives in the search block, where a visitor
  // without a session is already looking.
  it('offers nothing to click while you are not connected', () => {
    setup()

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  // A disabled button repeating the status line is not a control: once
  // connected, the only action left is leaving.
  it('offers to disconnect once connected', () => {
    setup({ connected: true })

    expect(deconnexion()).toBeInTheDocument()
  })

  it('reports the disconnect request', () => {
    const { onDisconnect } = setup({ connected: true })

    fireEvent.click(deconnexion()!)

    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  it('says where it stands, in the words it was handed', () => {
    setup({ connected: true, kind: 'ok', message: 'Connecté — 55 j restants.' })

    expect(screen.getByText('Connecté — 55 j restants.')).toBeInTheDocument()
  })
})
