// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ThemeToggle } from './ThemeToggle'
import type { Theme } from '../domain/theme'

afterEach(cleanup)

const setup = (theme: Theme = 'system') => {
  const onChange = vi.fn()
  render(<ThemeToggle theme={theme} onChange={onChange} />)
  return { onChange }
}

const choix = (name: string) => screen.getByRole('button', { name })

describe('ThemeToggle', () => {
  it('offre les trois choix sous un groupe nommé', () => {
    setup()

    expect(screen.getByRole('group', { name: 'Thème' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  // L'état est porté par `aria-pressed`, pas par la seule teinte du bouton :
  // le choix courant doit s'entendre autant qu'il se voit.
  it('annonce le choix courant, et lui seul', () => {
    setup('light')

    expect(choix('Clair')).toHaveAttribute('aria-pressed', 'true')
    expect(choix('Sombre')).toHaveAttribute('aria-pressed', 'false')
    expect(choix('Système')).toHaveAttribute('aria-pressed', 'false')
  })

  it('remonte le choix cliqué', () => {
    const { onChange } = setup('system')

    choix('Sombre').click()

    expect(onChange).toHaveBeenCalledWith('dark')
  })

  it('remonte aussi le retour au système', () => {
    const { onChange } = setup('dark')

    choix('Système').click()

    expect(onChange).toHaveBeenCalledWith('system')
  })
})
