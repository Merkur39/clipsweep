// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { SearchChip } from './SearchChip'

const setup = (query = '') => {
  const onQueryChange = vi.fn()
  render(<SearchChip query={query} onQueryChange={onQueryChange} />)
  return { onQueryChange }
}

const chip = () => screen.getByRole('button', { name: /Chercher/ })
const field = () => screen.getByRole('searchbox')

/**
 * The free-text search of the toolbar. It is the one filter that cannot be a
 * facet — a title is not a list of values — and the only one whose shortcut is
 * worth a key of its own.
 */
describe('SearchChip', () => {
  it('keeps its field folded until it is asked for', () => {
    setup()

    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('opens on a click', () => {
    setup()

    fireEvent.click(chip())

    expect(field()).toBeInTheDocument()
  })

  it('reports what is typed', () => {
    const { onQueryChange } = setup()
    fireEvent.click(chip())

    fireEvent.change(field(), { target: { value: 'boss' } })

    expect(onQueryChange).toHaveBeenCalledWith('boss')
  })

  it('carries what it is holding, so the chip reads without opening', () => {
    setup('boss')

    expect(chip()).toHaveTextContent('boss')
  })

  /**
   * The shortcut is drawn on the control it works, never filed in a help page:
   * it is the display that teaches it.
   */
  it('shows its shortcut while it holds nothing', () => {
    setup()

    expect(chip()).toHaveTextContent('/')
  })

  it('gives the room up to the value it holds', () => {
    setup('boss')

    expect(chip()).not.toHaveTextContent('/')
  })

  it('opens on the slash key', () => {
    setup()

    fireEvent.keyDown(document, { key: '/' })

    expect(field()).toBeInTheDocument()
  })

  // A slash typed into a field is a slash, not a shortcut.
  it('leaves the key alone while something else is being typed into', () => {
    setup()
    const elsewhere = document.createElement('input')
    document.body.append(elsewhere)
    elsewhere.focus()

    fireEvent.keyDown(elsewhere, { key: '/' })

    expect(screen.queryByRole('searchbox')).toBeNull()
    elsewhere.remove()
  })

  it('closes on escape', () => {
    setup()
    fireEvent.click(chip())

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})
