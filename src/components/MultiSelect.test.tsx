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
})
