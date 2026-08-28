// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { FilterChip } from './FilterChip'

const setup = (props: Partial<Parameters<typeof FilterChip>[0]> = {}) => {
  const onOpenChange = vi.fn()
  render(
    <FilterChip label="Dates" onOpenChange={onOpenChange} {...props}>
      <p>le panneau</p>
    </FilterChip>,
  )
  return { onOpenChange, chip: screen.getByRole('button', { name: /^Dates/ }) }
}

const panel = () => screen.queryByRole('group', { name: 'Dates' })

describe('FilterChip', () => {
  it('stays a bare word while the filter bites at nothing', () => {
    const { chip } = setup()

    expect(chip).toHaveTextContent(/^Dates$/)
    expect(chip).not.toHaveClass('is-on')
  })

  // The chip is the only thing on screen saying a filter is on: the value has
  // to be readable on it, not only inside the panel it opens.
  it('reads the value it bites at, and says so it is on', () => {
    const { chip } = setup({ value: '01/03/2024 →' })

    expect(chip).toHaveTextContent('Dates 01/03/2024 →')
    expect(chip).toHaveClass('is-on')
  })

  it('mounts no panel until it is opened', () => {
    setup()

    expect(panel()).toBeNull()
  })

  it('opens and closes on its own click', () => {
    const { chip } = setup()

    fireEvent.click(chip)
    expect(panel()).not.toBeNull()
    expect(chip).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(chip)
    expect(panel()).toBeNull()
    expect(chip).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on a click outside, and stays open on one inside', () => {
    const { chip } = setup()
    fireEvent.click(chip)

    fireEvent.pointerDown(screen.getByText('le panneau'))
    expect(panel()).not.toBeNull()

    fireEvent.pointerDown(document.body)
    expect(panel()).toBeNull()
  })

  it('closes on Escape', () => {
    const { chip } = setup()
    fireEvent.click(chip)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(panel()).toBeNull()
  })

  // What lets the windowed list inside a panel bring its scroller back to the
  // top: the panel is thrown away on close, and reopens at zero.
  it('reports every opening and every closing', () => {
    const { chip, onOpenChange } = setup()

    fireEvent.click(chip)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  })

  it('opens nothing when it has nothing to open', () => {
    const { chip } = setup({ disabled: true })

    expect(chip).toBeDisabled()
    fireEvent.click(chip)
    expect(panel()).toBeNull()
  })
})
