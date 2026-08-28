// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { ThemeToggle } from './ThemeToggle'
import type { Theme } from '../domain/theme'

const setup = (theme: Theme = 'system') => {
  const onChange = vi.fn()
  render(<ThemeToggle theme={theme} onChange={onChange} />)
  return { onChange }
}

const choice = (name: string) => screen.getByRole('button', { name })

describe('ThemeToggle', () => {
  it('offers the three choices under a named group', () => {
    setup()

    expect(screen.getByRole('group', { name: 'Thème' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  // The state is carried by `aria-pressed`, not by the button's tint alone: the
  // current choice must be heard as much as it is seen.
  it('announces the current choice, and only it', () => {
    setup('light')

    expect(choice('Clair')).toHaveAttribute('aria-pressed', 'true')
    expect(choice('Sombre')).toHaveAttribute('aria-pressed', 'false')
    expect(choice('Système')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the clicked choice', () => {
    const { onChange } = setup('system')

    choice('Sombre').click()

    expect(onChange).toHaveBeenCalledWith('dark')
  })

  it('reports the return to the system too', () => {
    const { onChange } = setup('dark')

    choice('Système').click()

    expect(onChange).toHaveBeenCalledWith('system')
  })
})
