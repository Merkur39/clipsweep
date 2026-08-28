// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import type { View } from '../domain/view'
import { ViewToggle } from './ViewToggle'

const setup = (view: View = 'table') => {
  const onChange = vi.fn()
  render(<ViewToggle view={view} onChange={onChange} />)
  return { onChange }
}

const choice = (name: string) => screen.getByRole('button', { name })

describe('ViewToggle', () => {
  it('offers the three densities under a named group', () => {
    setup()

    expect(screen.getByRole('group', { name: 'Affichage' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  // A control whose positions run along one quantity has to be laid out along
  // it: read left to right, the buttons go from the largest images to none.
  it('files them from the largest images to the table', () => {
    setup()

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Grandes vignettes (1)',
      'Vignettes serrées (2)',
      'Tableau (3)',
    ])
  })

  // Read without acting, as everywhere else: the state is heard through
  // `aria-pressed`, not guessed from a tint.
  it('announces the readout on screen, and only it', () => {
    setup('grid')

    expect(choice('Vignettes serrées (2)')).toHaveAttribute('aria-pressed', 'true')
    expect(choice('Grandes vignettes (1)')).toHaveAttribute('aria-pressed', 'false')
    expect(choice('Tableau (3)')).toHaveAttribute('aria-pressed', 'false')
  })

  /**
   * The key that works each one, named rather than drawn: three digits beside
   * three icons would half again the width of a control read at a glance. The
   * tooltip and the accessible name are where a reader looking for it looks.
   */
  it('names the key that works each density', () => {
    setup()

    expect(choice('Grandes vignettes (1)')).toHaveAttribute('title', 'Grandes vignettes (1)')
  })

  it('reports the density asked for', () => {
    const { onChange } = setup('table')

    choice('Vignettes serrées (2)').click()
    expect(onChange).toHaveBeenCalledWith('grid')

    choice('Grandes vignettes (1)').click()
    expect(onChange).toHaveBeenCalledWith('large')
  })
})
