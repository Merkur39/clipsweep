/**
 * The theme choice, and nothing more: the palette itself lives in CSS, where
 * every token carries both of its values inside a `light-dark()`.
 *
 * Following the system is therefore not a third theme to write — it is the act
 * of asserting nothing, and letting `color-scheme: light dark` decide.
 */
export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

const isTheme = (value: string): value is Theme => (THEMES as readonly string[]).includes(value)

/**
 * The preference lives in localStorage, so it is hand-editable and may date from
 * a version that named the themes differently. Anything that is not a recognized
 * choice falls back to the system, which is always a valid state.
 */
export function parseTheme(stored: string | null): Theme {
  return stored !== null && isTheme(stored) ? stored : 'system'
}

/**
 * Puts the choice on `<html>`. The attribute rewrites no token: it restricts
 * `color-scheme` to a single branch, and the `light-dark()` calls follow.
 *
 * Following the system clears the attribute rather than setting a third value:
 * a `data-theme="system"` would leave `color-scheme` pinned to the last choice,
 * which is exactly the opposite of what it announces.
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    return
  }
  root.setAttribute('data-theme', theme)
}
