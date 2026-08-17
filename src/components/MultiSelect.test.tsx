// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MultiSelect } from './MultiSelect'

afterEach(cleanup)

const options = [
  { value: 'SpiZ', count: 12 },
  { value: 'Ori', count: 5 },
  { value: 'Garami', count: 2 },
]

/**
 * The panel alone: the pill that opens it, and the deciding when, belong to
 * `FiltersBar` now. Mounting it is therefore all it takes to have it open.
 */
const setup = (selected: string[] = [], props: Partial<Parameters<typeof MultiSelect>[0]> = {}) => {
  const onChange = vi.fn()
  render(
    <MultiSelect
      id="creators-panel"
      label="Créateurs"
      options={options}
      selected={selected}
      onChange={onChange}
      {...props}
    />,
  )
  return { onChange }
}

// The box is a glyph-only button, named after the value it stands for: the
// count sits beside it, in the option's own row, not in its accessible name.
const option = (name: string) => within(panel()).getByRole('checkbox', { name })

const panel = () => screen.getByRole('group', { name: 'Créateurs' })

const list = () => document.querySelector('.opts') as HTMLElement

describe('MultiSelect', () => {
  it('lists the options with their count', () => {
    setup()

    expect(within(panel()).getAllByRole('checkbox')).toHaveLength(3)
    expect(panel()).toHaveTextContent('SpiZ')
    expect(panel()).toHaveTextContent('12')
  })

  it('marks the checked options, and only those', () => {
    setup(['Ori'])

    expect(option('Ori')).toHaveAttribute('aria-checked', 'true')
    expect(option('SpiZ')).toHaveAttribute('aria-checked', 'false')
  })

  it('reports the checked value without touching the others', () => {
    const { onChange } = setup(['Ori'])

    fireEvent.click(option('SpiZ'))

    expect(onChange).toHaveBeenCalledWith(['Ori', 'SpiZ'])
  })

  it('removes a value already checked', () => {
    const { onChange } = setup(['Ori', 'SpiZ'])

    fireEvent.click(option('Ori'))

    expect(onChange).toHaveBeenCalledWith(['SpiZ'])
  })

  it('empties the selection in one go', () => {
    const { onChange } = setup(['Ori', 'SpiZ'])

    fireEvent.click(within(panel()).getByRole('button', { name: 'Tout décocher' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('offers "Uncheck all" only when there is something to uncheck', () => {
    setup()

    expect(within(panel()).queryByRole('button', { name: 'Tout décocher' })).toBeNull()
  })

  // A facet can empty out under an open panel — a fresh sweep recomputes the
  // options while its pill is still open — so the panel says so itself rather
  // than standing blank.
  it('reads as empty for lack of options, rather than standing blank', () => {
    setup([], { options: [] })

    expect(within(panel()).queryAllByRole('checkbox')).toHaveLength(0)
    expect(panel()).toHaveTextContent('Rien à filtrer pour l’instant.')
  })

  // The name column is 149px wide and ellipsises anything longer — a game's
  // full title, or the id an unresolved category is named by, which is the very
  // part the label exists to carry.
  it('carries the full label on the option, past what the column can show', () => {
    setup([], {
      options: [{ value: '1', count: 3 }],
      labelOf: () => 'Tom Clancy’s Rainbow Six Siege',
    })

    expect(within(panel()).getByTitle('Tom Clancy’s Rainbow Six Siege')).toBeInTheDocument()
  })

  it('maps the values through the label provided', () => {
    setup([], {
      options: [{ value: '1', count: 3 }],
      labelOf: (value) => (value === '1' ? 'Cult of the Lamb' : value),
    })

    expect(panel()).toHaveTextContent('Cult of the Lamb')
  })

  // A facet the other filters have emptied still shows, at zero: it is drawn
  // back so the eye skips it, not withdrawn.
  it('marks the options the other filters have spent', () => {
    setup([], {
      options: [
        { value: 'SpiZ', count: 12 },
        { value: 'Ori', count: 0 },
      ],
    })

    expect(option('SpiZ').closest('label')).not.toHaveClass('spent')
    expect(option('Ori').closest('label')).toHaveClass('spent')
  })

  // Drawn back, never disabled: a checked value can fall to zero — the panel it
  // was checked from is the only place it can be unchecked.
  it('leaves a spent option clickable, so a checked one can be taken back', () => {
    const { onChange } = setup(['Ori'], {
      options: [{ value: 'Ori', count: 0 }],
    })

    fireEvent.click(option('Ori'))

    expect(onChange).toHaveBeenCalledWith([])
  })
})

// A sweep over a busy channel yields hundreds of creators and nearly as many
// games; the panel used to mount every one of them, twice over, on every open.
describe('MultiSelect, longues listes', () => {
  const many = Array.from({ length: 400 }, (_, index) => ({
    value: `créateur-${String(index).padStart(3, '0')}`,
    count: 400 - index,
  }))

  const setupLong = (selected: string[] = []) => setup(selected, { options: many })

  const scrollTo = (offset: number) => {
    list().scrollTop = offset
    fireEvent.scroll(list())
  }

  it('mounts a window of the options rather than the whole list', () => {
    setupLong()

    expect(within(panel()).getAllByRole('checkbox').length).toBeLessThan(50)
    expect(option('créateur-000')).toBeInTheDocument()
  })

  // The pitch is not drawn inline any more — the sheet's `--opt-row` places the
  // rows — so the spacer is what still states it: 400 options at 32px.
  it('reserves the height of the whole list, so the scrollbar tells the truth', () => {
    setupLong()

    expect(list().firstElementChild).toHaveStyle({ height: '12800px' })
  })

  it('mounts the options scrolled to, and lets go of those left behind', () => {
    setupLong()

    scrollTo(3000)

    expect(option('créateur-100')).toBeInTheDocument()
    expect(within(panel()).queryByRole('checkbox', { name: 'créateur-000' })).toBeNull()
  })

  it('keeps "Uncheck all" out of the scrolling list, in reach at any depth', () => {
    setupLong(['créateur-000'])

    const clear = within(panel()).getByRole('button', { name: 'Tout décocher' })
    expect(list().contains(clear)).toBe(false)
  })
})
