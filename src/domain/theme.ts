/**
 * Le choix de thème, et rien de plus : la palette elle-même vit en CSS, où
 * chaque jeton porte ses deux valeurs dans un `light-dark()`.
 *
 * Suivre le système n'est donc pas un troisième thème à écrire — c'est le fait
 * de ne rien affirmer, et de laisser `color-scheme: light dark` trancher.
 */
export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

const isTheme = (value: string): value is Theme => (THEMES as readonly string[]).includes(value)

/**
 * La préférence vit en localStorage, donc elle est modifiable à la main et peut
 * dater d'une version qui nommait les thèmes autrement. Tout ce qui n'est pas
 * un choix reconnu revient au système, qui est toujours un état valable.
 */
export function parseTheme(stored: string | null): Theme {
  return stored !== null && isTheme(stored) ? stored : 'system'
}

/**
 * Pose le choix sur `<html>`. L'attribut ne réécrit aucun jeton : il restreint
 * `color-scheme` à une seule branche, et les `light-dark()` suivent.
 *
 * Suivre le système efface l'attribut plutôt que d'en poser un troisième :
 * une valeur `data-theme="system"` laisserait `color-scheme` restreint au
 * dernier choix, ce qui est exactement le contraire de ce qu'elle annonce.
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    return
  }
  root.setAttribute('data-theme', theme)
}
