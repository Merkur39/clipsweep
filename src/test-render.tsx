import { render as rtlRender, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'

import { LocaleProvider } from './i18n/LocaleProvider'

/**
 * Rend un composant sous le fournisseur de langue, que tout composant traduit
 * exige.
 *
 * La langue servie est celle du navigateur de test, épinglée au français par
 * `test-setup.ts` : les attentes de ces tests sont écrites en français, et une
 * langue qui dépendrait de la machine les rendrait ingouvernables. Un test qui
 * vise l'anglais le déclare, en supplantant `navigator.languages` ou en posant
 * la préférence.
 */
export const render = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  rtlRender(ui, { ...options, wrapper: LocaleProvider })
