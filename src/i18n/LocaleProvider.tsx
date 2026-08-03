import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'

import {
  applyLocale,
  parseLocaleChoice,
  resolveLocale,
  type Locale,
  type LocaleChoice,
} from './locales'
import { makeT, type T } from './translate'
import { usePersistedState } from '../hooks/usePersistedState'

export interface Translation {
  /** The language actually served, once the choice is weighed against the browser. */
  locale: Locale
  t: T
  /** What the visitor chose — `auto` included, which is not a language. */
  choice: LocaleChoice
  setChoice: (choice: LocaleChoice) => void
}

const TranslationContext = createContext<Translation | null>(null)

/**
 * The application's language.
 *
 * The choice lives here rather than in `App` — unlike the theme — because `App`
 * has texts of its own to translate: it must sit *inside* the provider, so it
 * cannot hold its state.
 *
 * `localStorage` and not `sessionStorage`: this is a preference, on the same
 * footing as the theme, not a sweep parameter.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistedState('locale', 'auto')
  const choice = parseLocaleChoice(stored)
  // Read back on every render, like `today` in `App`: the browser's list can
  // change under our feet, and `auto` promises precisely to follow it.
  const locale = resolveLocale(choice, navigator.languages)

  // Already set on `<html>` by `main.tsx` before the first render; the effect
  // only serves the changes that follow.
  useEffect(() => applyLocale(document.documentElement, locale), [locale])

  const value = useMemo<Translation>(
    () => ({ locale, t: makeT(locale), choice, setChoice: setStored }),
    [locale, choice, setStored],
  )

  return <TranslationContext value={value}>{children}</TranslationContext>
}

export function useTranslation(): Translation {
  const value = useContext(TranslationContext)
  if (!value) throw new Error('useTranslation outside LocaleProvider')
  return value
}
