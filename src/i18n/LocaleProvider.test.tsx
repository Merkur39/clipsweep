// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider, useTranslation } from './LocaleProvider'
import { persistedKey } from '../hooks/usePersistedState'

afterEach(cleanup)
beforeEach(() => localStorage.clear())

/** Le navigateur du test : `navigator.languages` est en lecture seule. */
const speaks = (...languages: string[]) =>
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages)

function Probe() {
  const { locale, t, choice, setChoice } = useTranslation()

  return (
    <>
      <p>
        {locale} / {choice}
      </p>
      <p>{t('access.disconnected')}</p>
      <button type="button" onClick={() => setChoice('fr')}>
        français
      </button>
      <button type="button" onClick={() => setChoice('auto')}>
        auto
      </button>
    </>
  )
}

const mount = () =>
  render(
    <LocaleProvider>
      <Probe />
    </LocaleProvider>,
  )

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('LocaleProvider', () => {
  it('suit le navigateur quand rien n’a été choisi', () => {
    speaks('fr-FR', 'fr')
    mount()

    expect(screen.getByText('fr / auto')).toBeInTheDocument()
    expect(screen.getByText('Déconnecté de Twitch.')).toBeInTheDocument()
  })

  it('sert l’anglais à un navigateur non traduit', () => {
    speaks('de-DE')
    mount()

    expect(screen.getByText('en / auto')).toBeInTheDocument()
    expect(screen.getByText('Disconnected from Twitch.')).toBeInTheDocument()
  })

  it('relit un choix enregistré, contre le navigateur', () => {
    speaks('fr-FR')
    localStorage.setItem(persistedKey('locale'), 'en')
    mount()

    expect(screen.getByText('en / en')).toBeInTheDocument()
  })

  it('bascule et enregistre le choix', () => {
    speaks('en-US')
    mount()

    click('français')

    expect(screen.getByText('fr / fr')).toBeInTheDocument()
    expect(localStorage.getItem(persistedKey('locale'))).toBe('fr')
  })

  // Le retour à l'automatique doit rendre la main au navigateur, et non figer
  // la langue sur celle qui était servie au moment du clic.
  it('rend la main au navigateur en repassant en automatique', () => {
    speaks('en-US')
    localStorage.setItem(persistedKey('locale'), 'fr')
    mount()

    click('auto')

    expect(screen.getByText('en / auto')).toBeInTheDocument()
  })

  it('pose la langue servie sur la racine du document', () => {
    speaks('en-US')
    localStorage.setItem(persistedKey('locale'), 'fr')
    mount()
    expect(document.documentElement.getAttribute('lang')).toBe('fr')

    click('auto')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })
})
