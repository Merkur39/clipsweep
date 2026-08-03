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
  /** La langue réellement servie, une fois le choix confronté au navigateur. */
  locale: Locale
  t: T
  /** Ce que le visiteur a choisi — `auto` compris, qui n'est pas une langue. */
  choice: LocaleChoice
  setChoice: (choice: LocaleChoice) => void
}

const TranslationContext = createContext<Translation | null>(null)

/**
 * La langue de l'application.
 *
 * Le choix vit ici plutôt que dans `App` — contrairement au thème — parce que
 * `App` a lui-même des textes à traduire : il doit être *dans* le fournisseur,
 * donc il ne peut pas en porter l'état.
 *
 * `localStorage` et non `sessionStorage` : c'est une préférence, au même titre
 * que le thème, pas un paramètre de scan.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistedState('locale', 'auto')
  const choice = parseLocaleChoice(stored)
  // Relu à chaque rendu, comme `today` dans `App` : la liste du navigateur peut
  // changer sous nos pieds, et `auto` promet justement de la suivre.
  const locale = resolveLocale(choice, navigator.languages)

  // Déjà posé sur `<html>` par `main.tsx` avant le premier rendu ; l'effet ne
  // sert qu'aux changements qui suivent.
  useEffect(() => applyLocale(document.documentElement, locale), [locale])

  const value = useMemo<Translation>(
    () => ({ locale, t: makeT(locale), choice, setChoice: setStored }),
    [locale, choice, setStored],
  )

  return <TranslationContext value={value}>{children}</TranslationContext>
}

export function useTranslation(): Translation {
  const value = useContext(TranslationContext)
  if (!value) throw new Error('useTranslation hors de LocaleProvider')
  return value
}
