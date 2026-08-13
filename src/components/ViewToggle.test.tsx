// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { View } from '../domain/view'
import { ViewToggle } from './ViewToggle'

afterEach(cleanup)

const setup = (view: View = 'table') => {
  const onChange = vi.fn()
  render(<ViewToggle view={view} onChange={onChange} />)
  return { onChange }
}

const choice = (name: string) => screen.getByRole('button', { name })

describe('ViewToggle', () => {
  it('offers the two readouts under a named group', () => {
    setup()

    expect(screen.getByRole('group', { name: 'Affichage' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  // Read without acting, as everywhere else: the state is heard through
  // `aria-pressed`, not guessed from a tint.
  it('announces the readout on screen, and only it', () => {
    setup('grid')

    expect(choice('Vignettes')).toHaveAttribute('aria-pressed', 'true')
    expect(choice('Tableau')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the readout asked for', () => {
    const { onChange } = setup('table')

    choice('Vignettes').click()

    expect(onChange).toHaveBeenCalledWith('grid')
  })
})
