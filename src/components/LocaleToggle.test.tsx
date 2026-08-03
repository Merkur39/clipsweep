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

const choice = (name: string) => screen.getByRole('button', { name })

describe('LocaleToggle', () => {
  it('offers the three choices under a named group', () => {
    mount()

    expect(screen.getByRole('group', { name: 'Langue' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  /**
   * Every language names itself in its own language, and is therefore never
   * translated. Someone landing on an interface they cannot read must be able
   * to recognize their own: "Anglais" means nothing to an English speaker.
   */
  it('names every language in its own language', () => {
    mount()

    expect(choice('Français')).toBeInTheDocument()
    expect(choice('English')).toBeInTheDocument()
  })

  // The state is carried by `aria-pressed`, not by the button's tint alone.
  it('announces the current choice, and only it', () => {
    localStorage.setItem(persistedKey('locale'), 'en')
    mount()

    expect(choice('English')).toHaveAttribute('aria-pressed', 'true')
    expect(choice('Français')).toHaveAttribute('aria-pressed', 'false')
    expect(choice('Automatic')).toHaveAttribute('aria-pressed', 'false')
  })

  // The browser speaks French: "Automatic" is the default choice, and it is the
  // one pressed — not "Français", which was never chosen.
  it('tells the language served apart from the choice made', () => {
    mount()

    expect(choice('Automatique')).toHaveAttribute('aria-pressed', 'true')
    expect(choice('Français')).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the language of the whole interface', () => {
    mount()
    expect(choice('Automatique')).toBeInTheDocument()

    fireEvent.click(choice('English'))

    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(choice('Automatic')).toHaveAttribute('aria-pressed', 'false')
  })
})
