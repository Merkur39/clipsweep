import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Unmounting between tests, once for the whole suite.
 *
 * Testing Library only auto-cleans when the runner's globals are on, and they
 * are not here — every test imports what it uses. Left to each file, the line
 * is a convention, and a file that forgets it leaks its DOM into the next test
 * of the same file, where a `getByRole` then finds two of everything.
 *
 * `sequence.hooks` is `stack`, so this runs **after** a file's own `afterEach`:
 * a file that unmounts alongside something else — restoring a stubbed global,
 * putting real timers back — has to keep its own call, and does. Cleaning up
 * twice costs nothing.
 */
afterEach(cleanup)

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
 * jsdom implements no scrolling at all: `scrollTo` is simply absent, and the
 * log pane calls it on every entry to stay pinned to the bottom. Where the pane
 * would have scrolled to is the browser's business, not these tests': all that
 * is needed here is a call that does not throw.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}

/**
 * `window.scrollTo` is the other half of the same hole, and it is worse: jsdom
 * *defines* it and answers every call with a "Not implemented" error on its
 * virtual console. Both readouts scroll the page — one to keep the reader's
 * place across a change of density, the other to bring an order back to its
 * beginning — so the noise would be on every run. Replaced outright rather than
 * guarded on absence: what is there does not work.
 */
if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
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
 * Both stores, made to exist and to work, whatever the runtime underneath.
 *
 * Two failures to cover, and they do not look alike. Node 25 defines a global
 * `localStorage`, inert until `--localstorage-file` gives it a file, and it
 * shadows jsdom's: a test touching it would measure an object devoid of methods
 * rather than the behaviour of the code. Node 24 defines no `sessionStorage` at
 * all outside jsdom, and a test in the `node` environment touching it does not
 * fail on an assertion but on a `ReferenceError` — which is how this landed
 * green here and red on CI.
 *
 * The same guard answers both: replace whatever is there unless it already
 * behaves like a `Storage`.
 */
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (typeof globalThis[name]?.clear !== 'function') {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: memoryStorage(),
    })
  }
}

/**
 * jsdom parses media queries but never evaluates them: `matchMedia` is simply
 * absent. The stub answers "does not match" for everything, which is the wide
 * world — the one every test that does not say otherwise is written against. A
 * test after the narrow layout overrides it, and the hook it feeds is covered on
 * its own.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
