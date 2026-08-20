// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { View } from '../domain/view'
import { ViewToggle } from './ViewToggle'

afterEach(cleanup)

const setup = (view: View = 'large') => {
  const onChange = vi.fn()
  render(<ViewToggle view={view} onChange={onChange} />)
  return { onChange }
}

const choice = (name: string) => screen.getByRole('button', { name })

describe('ViewToggle', () => {
  it('offers the three readouts under a named group', () => {
    setup()

    expect(screen.getByRole('group', { name: 'Affichage' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  // Read without acting, as everywhere else: the state is heard through
  // `aria-pressed`, not guessed from a tint.
  it('announces the readout on screen, and only it', () => {
    setup('dense')

    expect(choice('Vignettes serrées')).toHaveAttribute('aria-pressed', 'true')
    expect(choice('Grandes vignettes')).toHaveAttribute('aria-pressed', 'false')
    expect(choice('Liste')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the readout asked for', () => {
    const { onChange } = setup('large')

    choice('Vignettes serrées').click()

    expect(onChange).toHaveBeenCalledWith('dense')
  })

  /**
   * The two galleries sit next to each other and the rows last: the control
   * reads as one axis of density, not as three unrelated shapes.
   */
  it('orders them from the loosest to the tightest', () => {
    setup()

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Grandes vignettes',
      'Vignettes serrées',
      'Liste',
    ])
  })
})
