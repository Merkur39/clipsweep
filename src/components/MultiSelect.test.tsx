// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

// Le nom accessible d'une option inclut son décompte : « SpiZ 12 ».
const option = (name: string) => within(panel()!).getByRole('checkbox', { name: new RegExp(name) })

const panel = () => screen.queryByRole('group', { name: 'Créateurs' })

describe('MultiSelect', () => {
  it('reste fermé tant qu’on ne l’ouvre pas', () => {
    setup()

    expect(panel()).toBeNull()
  })

  it('annonce « Tous » quand rien n’est coché', () => {
    const { button } = setup()

    expect(button).toHaveTextContent('Tous')
  })

  it('liste les options avec leur décompte à l’ouverture', () => {
    const { button } = setup()

    fireEvent.click(button)

    const options = within(panel()!).getAllByRole('checkbox')
    expect(options).toHaveLength(3)
    expect(panel()).toHaveTextContent('SpiZ')
    expect(panel()).toHaveTextContent('12')
  })

  it('remonte la valeur cochée sans toucher aux autres', () => {
    const { button, onChange } = setup(['Ori'])

    fireEvent.click(button)
    fireEvent.click(option('SpiZ'))

    expect(onChange).toHaveBeenCalledWith(['Ori', 'SpiZ'])
  })

  it('retire une valeur déjà cochée', () => {
    const { button, onChange } = setup(['Ori', 'SpiZ'])

    fireEvent.click(button)
    fireEvent.click(option('Ori'))

    expect(onChange).toHaveBeenCalledWith(['SpiZ'])
  })

  it('vide la sélection d’un coup', () => {
    const { button, onChange } = setup(['Ori', 'SpiZ'])

    fireEvent.click(button)
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Tout décocher' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('ne propose « Tout décocher » que s’il y a quelque chose à décocher', () => {
    const { button } = setup()

    fireEvent.click(button)

    expect(within(panel()!).queryByRole('button', { name: 'Tout décocher' })).toBeNull()
  })

  it('se ferme au clic à l’extérieur', () => {
    const { button } = setup()
    fireEvent.click(button)
    expect(panel()).not.toBeNull()

    fireEvent.pointerDown(document.body)

    expect(panel()).toBeNull()
  })

  it('reste ouvert au clic à l’intérieur', () => {
    const { button } = setup()
    fireEvent.click(button)

    fireEvent.pointerDown(option('SpiZ'))

    expect(panel()).not.toBeNull()
  })

  it('se ferme sur Échap', () => {
    const { button } = setup()
    fireEvent.click(button)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(panel()).toBeNull()
  })

  it('traduit les valeurs via le libellé fourni', () => {
    const { button } = setup([], {
      options: [{ value: '1', count: 3 }],
      labelOf: (value) => (value === '1' ? 'Cult of the Lamb' : value),
    })

    fireEvent.click(button)

    expect(panel()).toHaveTextContent('Cult of the Lamb')
  })

  it('se désactive faute d’options, plutôt que d’ouvrir un panneau vide', () => {
    const { button } = setup([], { options: [] })

    expect(button).toBeDisabled()
  })
})
