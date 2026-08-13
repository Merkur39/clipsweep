import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement ResizeObserver, which the virtualized table uses to
 * measure its viewport. An inert observer is enough: the component's default
 * height amply covers the volumes tested, and the goal here is to check sorting
 * and scrolling, not measurement.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

/**
 * jsdom declares `<dialog>` but implements none of its behaviour: `showModal`
 * and `close` are simply absent, and calling one throws. The top layer, the
 * backdrop and the focus trap belong to the browser and are not what these
 * tests are after — reflecting the `open` attribute is enough for the player's
 * own logic to be observable.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

/**
 * The test browser's language, pinned.
 *
 * The tests' expectations are written in French; making them depend on the
 * machine's locale — or on whatever jsdom decides — would leave them green here
 * and red elsewhere. A test aiming at English overrides this value.
 */
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    get: () => ['fr-FR', 'fr'],
  })
}

/** The browser's `Storage`, in memory and without persistence. */
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
 * Node 25 defines a global `localStorage`, inert until `--localstorage-file`
 * gives it a file, and it shadows jsdom's — `sessionStorage`, for its part,
 * arrives intact. Without this replacement, any test touching storage measures
 * an object devoid of methods rather than the behaviour of the code.
 */
if (typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: memoryStorage(),
  })
}
