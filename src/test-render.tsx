import { render as rtlRender, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'

import { LocaleProvider } from './i18n/LocaleProvider'

/**
 * Renders a component under the locale provider, which every translated
 * component requires.
 *
 * The language served is the test browser's, pinned to French by
 * `test-setup.ts`: these tests' expectations are written in French, and a
 * language that depended on the machine would make them ungovernable. A test
 * aiming at English declares it, by overriding `navigator.languages` or by
 * setting the preference.
 */
export const render = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  rtlRender(ui, { ...options, wrapper: LocaleProvider })
