import '@testing-library/jest-dom/vitest'

/**
 * jsdom n'implémente pas ResizeObserver, dont la table virtualisée se sert pour
 * mesurer sa fenêtre. Un observateur inerte suffit : la hauteur par défaut du
 * composant couvre largement les volumes testés, et l'objectif ici est de
 * vérifier le tri et le défilement, pas la mesure.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
