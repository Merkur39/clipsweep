// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider, useTranslation } from './LocaleProvider'
import { persistedKey } from '../hooks/usePersistedState'

beforeEach(() => localStorage.clear())

/** The test's browser: `navigator.languages` is read-only. */
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
        french
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
  it('follows the browser when nothing has been chosen', () => {
    speaks('fr-FR', 'fr')
    mount()

    expect(screen.getByText('fr / auto')).toBeInTheDocument()
    expect(screen.getByText('Déconnecté de Twitch')).toBeInTheDocument()
  })

  it('serves English to an untranslated browser', () => {
    speaks('de-DE')
    mount()

    expect(screen.getByText('en / auto')).toBeInTheDocument()
    expect(screen.getByText('Disconnected from Twitch')).toBeInTheDocument()
  })

  it('reads back a stored choice, against the browser', () => {
    speaks('fr-FR')
    localStorage.setItem(persistedKey('locale'), 'en')
    mount()

    expect(screen.getByText('en / en')).toBeInTheDocument()
  })

  it('switches and stores the choice', () => {
    speaks('en-US')
    mount()

    click('french')

    expect(screen.getByText('fr / fr')).toBeInTheDocument()
    expect(localStorage.getItem(persistedKey('locale'))).toBe('fr')
  })

  // Going back to automatic must hand control back to the browser, not freeze
  // the language on whichever was being served at the moment of the click.
  it('hands control back to the browser when returning to automatic', () => {
    speaks('en-US')
    localStorage.setItem(persistedKey('locale'), 'fr')
    mount()

    click('auto')

    expect(screen.getByText('en / auto')).toBeInTheDocument()
  })

  it('puts the language served on the document root', () => {
    speaks('en-US')
    localStorage.setItem(persistedKey('locale'), 'fr')
    mount()
    expect(document.documentElement.getAttribute('lang')).toBe('fr')

    click('auto')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })
})
