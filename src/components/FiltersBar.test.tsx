// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FiltersBar } from './FiltersBar'

afterEach(cleanup)

const setup = (props: Partial<Parameters<typeof FiltersBar>[0]> = {}) => {
  const handlers = {
    onMinViewsChange: vi.fn(),
    onMaxViewsChange: vi.fn(),
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
    onCreatorsChange: vi.fn(),
    onGameIdsChange: vi.fn(),
    onReset: vi.fn(),
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
      filtersActive={false}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

// A pill reads as its facet's name followed by its current value — "Plage
// Toutes" — so the name is the stable half to anchor a query on.
const pill = (facet: string) => screen.getByRole('button', { name: new RegExp(`^${facet}`) })

/** The panel a pill mounts under itself, named after the facet it filters. */
const panel = (facet: string) => screen.queryByRole('group', { name: facet })

/** Every field lives behind a pill now: opening the right one comes first. */
const open = (facet: string) => {
  fireEvent.click(pill(facet))
  return within(panel(facet) as HTMLElement)
}

describe('FiltersBar', () => {
  it('reports the floor typed on the views', () => {
    const { onMinViewsChange } = setup()

    fireEvent.change(open('Vues').getByLabelText('Vues min'), { target: { value: '50' } })

    expect(onMinViewsChange).toHaveBeenCalledWith('50')
  })

  it('reports the ceiling typed on the views', () => {
    const { onMaxViewsChange } = setup()

    fireEvent.change(open('Vues').getByLabelText('Vues max'), { target: { value: '5000' } })

    expect(onMaxViewsChange).toHaveBeenCalledWith('5000')
  })

  it('reports the start bound typed', () => {
    const { onFromChange } = setup()

    fireEvent.change(open('Plage').getByLabelText('Du'), { target: { value: '2020-01-01' } })

    expect(onFromChange).toHaveBeenCalledWith('2020-01-01')
  })

  it('reports the end bound typed', () => {
    const { onToChange } = setup()

    fireEvent.change(open('Plage').getByLabelText('Au'), { target: { value: '2020-06-30' } })

    expect(onToChange).toHaveBeenCalledWith('2020-06-30')
  })

  // A date outside the collected set can return nothing: the picker greys it out.
  it('bounds both fields on the extent of the collected clips', () => {
    setup()

    const range = open('Plage')

    expect(range.getByLabelText('Du')).toHaveAttribute('min', '2019-03-04')
    expect(range.getByLabelText('Du')).toHaveAttribute('max', '2021-12-25')
    expect(range.getByLabelText('Au')).toHaveAttribute('min', '2019-03-04')
    expect(range.getByLabelText('Au')).toHaveAttribute('max', '2021-12-25')
  })

  it('sets no bound while no clip has been collected', () => {
    setup({ dateBounds: null })

    const from = open('Plage').getByLabelText('Du')

    expect(from).not.toHaveAttribute('min')
    expect(from).not.toHaveAttribute('max')
  })

  it('offers clearing only once the date is set', () => {
    setup()

    expect(open('Plage').queryByRole('button', { name: 'Effacer Du' })).toBeNull()
  })

  it('empties the date through its clear button', () => {
    const { onFromChange } = setup({ from: '2020-01-01' })

    fireEvent.click(open('Plage').getByRole('button', { name: 'Effacer Du' }))

    expect(onFromChange).toHaveBeenCalledWith('')
  })

  // The blanket reset has come back into the row, at its end: it used to sit at
  // the end of the "Results" label for want of a column here, and a row of four
  // pills has the column.
  it('carries the blanket reset, beside what it resets', () => {
    const { onReset } = setup({ from: '2020-01-01', filtersActive: true })

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

    expect(onReset).toHaveBeenCalled()
  })
})

// The pill is the closed state of a filter. Its panel is mounted on opening and
// thrown away on closing, so the queries below read the DOM, never a class.
describe('FiltersBar, the pills', () => {
  it('opens its panel, and closes it again', () => {
    setup()
    expect(panel('Plage')).toBeNull()

    fireEvent.click(pill('Plage'))
    expect(panel('Plage')).not.toBeNull()

    fireEvent.click(pill('Plage'))
    expect(panel('Plage')).toBeNull()
  })

  it('closes on a pointer landing outside', () => {
    setup()
    fireEvent.click(pill('Plage'))

    fireEvent.pointerDown(document.body)

    expect(panel('Plage')).toBeNull()
  })

  // The press is where the intent is expressed: a drag begun on a field and
  // released off the panel must not dismiss the very thing it was aimed at.
  it('stays open on a pointer landing inside', () => {
    setup()
    const range = open('Plage')

    fireEvent.pointerDown(range.getByLabelText('Du'))

    expect(panel('Plage')).not.toBeNull()
  })

  it('closes on Escape', () => {
    setup()
    fireEvent.click(pill('Plage'))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(panel('Plage')).toBeNull()
  })

  // `aria-disabled` and not `disabled`: the pill keeps its place in the tab
  // order and still announces its facet and its value. Only the opening is barred.
  it('is unavailable for lack of options, rather than opening an empty panel', () => {
    setup({ creatorFacets: [] })

    expect(pill('Créateurs')).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(pill('Créateurs'))

    expect(panel('Créateurs')).toBeNull()
  })

  // What makes a panel affordable: it is never the only way to know what the
  // facet is letting through.
  it('states its current value while closed', () => {
    setup({ creatorFacets: [{ value: 'SpiZ', count: 12 }], creators: ['SpiZ'] })

    expect(pill('Créateurs')).toHaveTextContent('SpiZ')
    expect(panel('Créateurs')).toBeNull()
  })
})
