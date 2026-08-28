// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SORT, type ClipSort } from '../domain/sort'
import { SortChip } from './SortChip'

const setup = (sort: ClipSort = DEFAULT_SORT) => {
  const onChange = vi.fn()
  render(<SortChip sort={sort} onChange={onChange} />)
  return { onChange, chip: screen.getByRole('button', { name: /^Trier/ }) }
}

const panel = () => screen.getByRole('group', { name: 'Trier' })

describe('SortChip', () => {
  // An order is always in force, so the chip always has something to read — and
  // for the same reason it never wears the accent, which on the chips beside it
  // means a filter is holding something back.
  it('reads the key in force without claiming to be a filter', () => {
    const { chip } = setup({ key: 'date', direction: 'asc' })

    expect(chip).toHaveTextContent('Trier Date')
    expect(chip).not.toHaveClass('is-on')
  })

  it('offers every key the readouts order on', () => {
    const { chip } = setup()
    fireEvent.click(chip)

    for (const name of ['Vues', 'Date', 'Titre', 'Créateur', 'Durée']) {
      expect(within(panel()).getByRole('button', { name: new RegExp(name) })).toBeInTheDocument()
    }
  })

  it('announces the key in force, and only it', () => {
    const { chip } = setup({ key: 'title', direction: 'asc' })
    fireEvent.click(chip)

    expect(within(panel()).getByRole('button', { name: /Titre/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(panel()).getByRole('button', { name: /Vues/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the key asked for', () => {
    const { chip, onChange } = setup()
    fireEvent.click(chip)

    fireEvent.click(within(panel()).getByRole('button', { name: /Créateur/ }))

    expect(onChange).toHaveBeenCalledWith('creator')
  })

  // The key in force answers a second click by turning round, as the column
  // heads of the list do: one control, one rule.
  it('reports the key in force again, for the caller to flip it', () => {
    const { chip, onChange } = setup({ key: 'views', direction: 'asc' })
    fireEvent.click(chip)

    fireEvent.click(within(panel()).getByRole('button', { name: /Vues/ }))

    expect(onChange).toHaveBeenCalledWith('views')
  })

  // It stays open on a choice, deliberately: turning an order round is a second
  // click on the same key, and a panel that shut would make the reader open it
  // again to do the one thing they were most likely to do next.
  it('stays open once a key has been chosen', () => {
    const { chip } = setup()
    fireEvent.click(chip)

    fireEvent.click(within(panel()).getByRole('button', { name: /Date/ }))

    expect(screen.queryByRole('group', { name: 'Trier' })).not.toBeNull()
  })
})
