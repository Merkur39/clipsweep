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

/** Le `Storage` du navigateur, en mémoire et sans persistance. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, String(value)),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
  }
}

/**
 * Node 25 définit un `localStorage` global, inerte tant que `--localstorage-file`
 * ne lui donne pas de fichier, et il masque celui de jsdom — `sessionStorage`,
 * lui, arrive intact. Sans ce remplacement, tout test qui touche au stockage
 * mesure un objet dépourvu de méthodes plutôt que le comportement du code.
 */
if (typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: memoryStorage(),
  })
}
