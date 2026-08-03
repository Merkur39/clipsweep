// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleToggle } from './LocaleToggle'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { persistedKey } from '../hooks/usePersistedState'

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR'])
})

const mount = () =>
  render(
    <LocaleProvider>
      <LocaleToggle />
    </LocaleProvider>,
  )

const choix = (name: string) => screen.getByRole('button', { name })

describe('LocaleToggle', () => {
  it('offre les trois choix sous un groupe nommé', () => {
    mount()

    expect(screen.getByRole('group', { name: 'Langue' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  /**
   * Chaque langue se nomme dans sa propre langue, et n'est donc jamais traduite.
   * Celui qui tombe sur une interface qu'il ne lit pas doit pouvoir y
   * reconnaître la sienne : « Anglais » ne dit rien à un anglophone.
   */
  it('nomme chaque langue dans sa propre langue', () => {
    mount()

    expect(choix('Français')).toBeInTheDocument()
    expect(choix('English')).toBeInTheDocument()
  })

  // L'état est porté par `aria-pressed`, pas par la seule teinte du bouton.
  it('annonce le choix courant, et lui seul', () => {
    localStorage.setItem(persistedKey('locale'), 'en')
    mount()

    expect(choix('English')).toHaveAttribute('aria-pressed', 'true')
    expect(choix('Français')).toHaveAttribute('aria-pressed', 'false')
    expect(choix('Automatic')).toHaveAttribute('aria-pressed', 'false')
  })

  // Le navigateur parle français : « Automatique » est le choix par défaut, et
  // c'est lui qui est enfoncé — pas « Français », qui n'a pas été choisi.
  it('distingue la langue servie du choix fait', () => {
    mount()

    expect(choix('Automatique')).toHaveAttribute('aria-pressed', 'true')
    expect(choix('Français')).toHaveAttribute('aria-pressed', 'false')
  })

  it('bascule la langue de toute l’interface', () => {
    mount()
    expect(choix('Automatique')).toBeInTheDocument()

    fireEvent.click(choix('English'))

    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(choix('Automatic')).toHaveAttribute('aria-pressed', 'false')
  })
})
