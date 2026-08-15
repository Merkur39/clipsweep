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

const setup = (selected: string[] = [], props: Partial<Parameters<typeof MultiSelect>[0]> = {}) => {
  const onChange = vi.fn()
  render(
    <MultiSelect
      label="Créateurs"
      options={options}
      selected={selected}
      onChange={onChange}
      {...props}
    />,
  )
  return { onChange, button: screen.getByRole('button', { name: /^Créateurs/ }) }
}

// An option's accessible name includes its count: "SpiZ 12".
const option = (name: string) => within(panel()!).getByRole('checkbox', { name: new RegExp(name) })

const panel = () => screen.queryByRole('group', { name: 'Créateurs' })

const list = () => document.querySelector('.multiselect-options') as HTMLElement

describe('MultiSelect', () => {
  it('stays closed until it is opened', () => {
    setup()

    expect(panel()).toBeNull()
  })

  it('announces "All" when nothing is checked', () => {
    const { button } = setup()

    expect(button).toHaveTextContent('Tous')
  })

  it('lists the options with their count on opening', () => {
    const { button } = setup()

    fireEvent.click(button)

    const options = within(panel()!).getAllByRole('checkbox')
    expect(options).toHaveLength(3)
    expect(panel()).toHaveTextContent('SpiZ')
    expect(panel()).toHaveTextContent('12')
  })

  it('reports the checked value without touching the others', () => {
    const { button, onChange } = setup(['Ori'])

    fireEvent.click(button)
    fireEvent.click(option('SpiZ'))

    expect(onChange).toHaveBeenCalledWith(['Ori', 'SpiZ'])
  })

  it('removes a value already checked', () => {
    const { button, onChange } = setup(['Ori', 'SpiZ'])

    fireEvent.click(button)
    fireEvent.click(option('Ori'))

    expect(onChange).toHaveBeenCalledWith(['SpiZ'])
  })

  it('empties the selection in one go', () => {
    const { button, onChange } = setup(['Ori', 'SpiZ'])

    fireEvent.click(button)
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Tout décocher' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('offers "Uncheck all" only when there is something to uncheck', () => {
    const { button } = setup()

    fireEvent.click(button)

    expect(within(panel()!).queryByRole('button', { name: 'Tout décocher' })).toBeNull()
  })

  it('closes on a click outside', () => {
    const { button } = setup()
    fireEvent.click(button)
    expect(panel()).not.toBeNull()

    fireEvent.pointerDown(document.body)

    expect(panel()).toBeNull()
  })

  it('stays open on a click inside', () => {
    const { button } = setup()
    fireEvent.click(button)

    fireEvent.pointerDown(option('SpiZ'))

    expect(panel()).not.toBeNull()
  })

  it('closes on Escape', () => {
    const { button } = setup()
    fireEvent.click(button)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(panel()).toBeNull()
  })

  // The name column is 149px wide and ellipsises anything longer — a game's
  // full title, or the id an unresolved category is named by, which is the very
  // part the label exists to carry.
  it('carries the full label on the option, past what the column can show', () => {
    const { button } = setup([], {
      options: [{ value: '1', count: 3 }],
      labelOf: () => 'Tom Clancy’s Rainbow Six Siege',
    })

    fireEvent.click(button)

    expect(within(panel()!).getByTitle('Tom Clancy’s Rainbow Six Siege')).toBeInTheDocument()
  })

  it('maps the values through the label provided', () => {
    const { button } = setup([], {
      options: [{ value: '1', count: 3 }],
      labelOf: (value) => (value === '1' ? 'Cult of the Lamb' : value),
    })

    fireEvent.click(button)

    expect(panel()).toHaveTextContent('Cult of the Lamb')
  })

  it('disables itself for lack of options, rather than opening an empty panel', () => {
    const { button } = setup([], { options: [] })

    expect(button).toBeDisabled()
  })

  // A facet the other filters have emptied still shows, at zero: it is drawn
  // back so the eye skips it, not withdrawn.
  it('marks the options the other filters have spent', () => {
    const { button } = setup([], {
      options: [
        { value: 'SpiZ', count: 12 },
        { value: 'Ori', count: 0 },
      ],
    })

    fireEvent.click(button)

    expect(option('SpiZ').closest('label')).not.toHaveClass('is-spent')
    expect(option('Ori').closest('label')).toHaveClass('is-spent')
  })

  // Drawn back, never disabled: a checked value can fall to zero — the panel it
  // was checked from is the only place it can be unchecked.
  it('leaves a spent option clickable, so a checked one can be taken back', () => {
    const { button, onChange } = setup(['Ori'], {
      options: [{ value: 'Ori', count: 0 }],
    })

    fireEvent.click(button)
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

  const openLong = (selected: string[] = []) => {
    const rendered = setup(selected, { options: many })
    fireEvent.click(rendered.button)
    return rendered
  }

  const scrollTo = (offset: number) => {
    list().scrollTop = offset
    fireEvent.scroll(list())
  }

  it('mounts a window of the options rather than the whole list', () => {
    openLong()

    expect(within(panel()!).getAllByRole('checkbox').length).toBeLessThan(50)
    expect(option('créateur-000')).toBeInTheDocument()
  })

  it('reserves the height of the whole list, so the scrollbar tells the truth', () => {
    openLong()

    expect(list().firstElementChild).toHaveStyle({ height: '12800px' })
  })

  it('mounts the options scrolled to, and lets go of those left behind', () => {
    openLong()

    scrollTo(3000)

    expect(option('créateur-100')).toBeInTheDocument()
    expect(within(panel()!).queryByRole('checkbox', { name: /créateur-000/ })).toBeNull()
  })

  // The panel is unmounted on close, so the DOM reopens at the top; the window
  // has to be told, or it would draw the options from where we left off against
  // a scroller sitting at zero.
  it('reopens at the top of the list after having been closed further down', () => {
    const { button } = openLong()
    scrollTo(3000)

    fireEvent.click(button)
    fireEvent.click(button)

    expect(option('créateur-000')).toBeInTheDocument()
  })

  it('keeps "Uncheck all" out of the scrolling list, in reach at any depth', () => {
    openLong(['créateur-000'])

    const clear = within(panel()!).getByRole('button', { name: 'Tout décocher' })
    expect(list().contains(clear)).toBe(false)
  })
})
