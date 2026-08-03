// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
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

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement

describe('FiltersBar', () => {
  it('reports the start bound typed', () => {
    const { onFromChange } = setup()

    fireEvent.change(field('Du'), { target: { value: '2020-01-01' } })

    expect(onFromChange).toHaveBeenCalledWith('2020-01-01')
  })

  it('reports the end bound typed', () => {
    const { onToChange } = setup()

    fireEvent.change(field('Au'), { target: { value: '2020-06-30' } })

    expect(onToChange).toHaveBeenCalledWith('2020-06-30')
  })

  // A date outside the collected set can return nothing: the picker greys it out.
  it('bounds both fields on the extent of the collected clips', () => {
    setup()

    expect(field('Du')).toHaveAttribute('min', '2019-03-04')
    expect(field('Du')).toHaveAttribute('max', '2021-12-25')
    expect(field('Au')).toHaveAttribute('min', '2019-03-04')
    expect(field('Au')).toHaveAttribute('max', '2021-12-25')
  })

  it('sets no bound while no clip has been collected', () => {
    setup({ dateBounds: null })

    expect(field('Du')).not.toHaveAttribute('min')
    expect(field('Du')).not.toHaveAttribute('max')
  })

  it('offers clearing only once the date is set', () => {
    setup()

    expect(screen.queryByRole('button', { name: 'Effacer Du' })).toBeNull()
  })

  it('empties the date through its clear button', () => {
    const { onFromChange } = setup({ from: '2020-01-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Effacer Du' }))

    expect(onFromChange).toHaveBeenCalledWith('')
  })

  // The blanket reset has left the row: every control carries its own, and the
  // global button lives at the end of the "Results" label.
  it('carries no blanket reset', () => {
    setup({ from: '2020-01-01' })

    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).toBeNull()
  })
})
