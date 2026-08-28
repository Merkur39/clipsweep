// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FiltersBar } from './FiltersBar'

const setup = (props: Partial<Parameters<typeof FiltersBar>[0]> = {}) => {
  const handlers = {
    onMinViewsChange: vi.fn(),
    onMaxViewsChange: vi.fn(),
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
    onCreatorsChange: vi.fn(),
    onGameIdsChange: vi.fn(),
  }
  render(
    <FiltersBar
      minViews=""
      maxViews=""
      from=""
      to=""
      dateBounds={{ first: '2019-03-04', last: '2021-12-25' }}
      creatorFacets={[]}
      creators={[]}
      gameFacets={[]}
      gameIds={[]}
      gameLabel={(id) => id}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

const chip = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

const open = (name: string) => {
  fireEvent.click(chip(name))
  return screen.getByRole('group', { name })
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement

describe('FiltersBar', () => {
  // Four chips where six labelled fields used to stand permanently: at rest a
  // chip says what its filter is worth, and asks for room only while it is set.
  it('wears each filter as a chip, and opens none of them by itself', () => {
    setup()

    for (const name of ['Vues', 'Dates', 'Créateurs', 'Jeux']) expect(chip(name)).toBeDefined()
    expect(screen.queryByLabelText('Du')).toBeNull()
  })

  it('reports the start bound typed', () => {
    const { onFromChange } = setup()
    open('Dates')

    fireEvent.change(field('Du'), { target: { value: '2020-01-01' } })

    expect(onFromChange).toHaveBeenCalledWith('2020-01-01')
  })

  it('reports the end bound typed', () => {
    const { onToChange } = setup()
    open('Dates')

    fireEvent.change(field('Au'), { target: { value: '2020-06-30' } })

    expect(onToChange).toHaveBeenCalledWith('2020-06-30')
  })

  it('reports the thresholds typed', () => {
    const { onMinViewsChange, onMaxViewsChange } = setup()
    open('Vues')

    fireEvent.change(field('Vues min'), { target: { value: '500' } })
    fireEvent.change(field('Vues max'), { target: { value: '9000' } })

    expect(onMinViewsChange).toHaveBeenCalledWith('500')
    expect(onMaxViewsChange).toHaveBeenCalledWith('9000')
  })

  // A date outside the collected set can return nothing: the picker greys it out.
  it('bounds both fields on the extent of the collected clips', () => {
    setup()
    open('Dates')

    expect(field('Du')).toHaveAttribute('min', '2019-03-04')
    expect(field('Du')).toHaveAttribute('max', '2021-12-25')
    expect(field('Au')).toHaveAttribute('min', '2019-03-04')
    expect(field('Au')).toHaveAttribute('max', '2021-12-25')
  })

  it('sets no bound while no clip has been collected', () => {
    setup({ dateBounds: null })
    open('Dates')

    expect(field('Du')).not.toHaveAttribute('min')
    expect(field('Du')).not.toHaveAttribute('max')
  })

  it('offers clearing only once the date is set', () => {
    setup()
    const panel = open('Dates')

    expect(within(panel).queryByRole('button', { name: 'Effacer Du' })).toBeNull()
  })

  it('empties the date through its clear button', () => {
    const { onFromChange } = setup({ from: '2020-01-01' })
    const panel = open('Dates')

    fireEvent.click(within(panel).getByRole('button', { name: 'Effacer Du' }))

    expect(onFromChange).toHaveBeenCalledWith('')
  })

  // Closed, the chip is the only thing on screen saying the filter is on.
  it('reads its thresholds on the closed chip', () => {
    setup({ minViews: '1000' })

    expect(chip('Vues')).toHaveTextContent('Vues ≥ 1')
    expect(chip('Vues')).toHaveClass('is-on')
  })

  it('reads both bounds on the closed chip', () => {
    setup({ from: '2020-01-01', to: '' })

    expect(chip('Dates')).toHaveTextContent('Dates 01/01/2020 →')
  })

  // A search fills both date fields with the period it ran on, and the chip is
  // lit from then on. It is a state of the running application that no mockup
  // shows, and the chip must not deny it: those two dates are what the readout
  // below is drawn from.
  it('stays lit on the period a search opened, narrowing or not', () => {
    setup({ from: '2019-03-04', to: '2021-12-25' })

    expect(chip('Dates')).toHaveTextContent('Dates 04/03/2019 → 25/12/2021')
    expect(chip('Dates')).toHaveClass('is-on')
  })

  // The blanket reset has left the row: every chip carries its own, and the
  // global button lives at the end of the "Results" label.
  it('carries no blanket reset', () => {
    setup({ from: '2020-01-01' })

    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).toBeNull()
  })
})

/**
 * On a phone the four fold into one: four chips wrap onto two rows where the
 * toolbar is already carrying a sort, a search and a density.
 */
describe('FiltersBar, folded', () => {
  const narrow = () =>
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))

  afterEach(() => vi.unstubAllGlobals())

  it('offers one chip instead of four', () => {
    narrow()
    setup()

    expect(screen.getByRole('button', { name: /Filtrer/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Créateurs/ })).toBeNull()
  })

  it('opens the four behind it', () => {
    narrow()
    setup()

    fireEvent.click(screen.getByRole('button', { name: /Filtrer/ }))

    expect(screen.getByRole('button', { name: /^Créateurs/ })).toBeInTheDocument()
  })

  // What a row of four says by being lit, one chip has to say with a number.
  it('counts the filters that bite', () => {
    narrow()
    setup({ maxViews: '50', creators: ['SpiZ'] })

    expect(screen.getByRole('button', { name: /Filtrer/ })).toHaveTextContent('2')
  })

  it('says nothing of a count while none of them bites', () => {
    narrow()
    setup()

    expect(screen.getByRole('button', { name: /Filtrer/ })).not.toHaveTextContent(/\d/)
  })
})
