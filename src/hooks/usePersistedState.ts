import { useEffect, useState } from 'react'

/** Exported so `main.tsx` reads the theme under the same key, before rendering. */
export const persistedKey = (key: string) => `getclip.${key}`

/**
 * A render state backed by a browser store, read back on mount.
 *
 * The store is chosen at the call site, and that choice is a choice of lifetime:
 * `localStorage` for a preference that must outlive the tab — the theme —,
 * `sessionStorage` for what only targets one search. Finding the channel and the
 * period of a closed session again would restart, on the first click, a search
 * nobody asked for in this particular tab.
 */
export function usePersistedState(key: string, initial: string, store: Storage = localStorage) {
  const [value, setValue] = useState(() => store.getItem(persistedKey(key)) ?? initial)
  useEffect(() => store.setItem(persistedKey(key), value), [key, store, value])
  return [value, setValue] as const
}

/** What lived in `localStorage` until 2026-08-02, and no longer belongs there. */
const SESSION_SCOPED = ['channel', 'channels', 'since', 'until']

/**
 * Erases from a durable store the keys moved to the tab's lifetime.
 *
 * Ceasing to read them does not erase them: without this pass, the channel
 * visited and the period searched back then would stay on the visitor's machine,
 * serving nothing — the opposite of what the change was after. The theme, for
 * its part, really is a durable preference and stays.
 */
export function forgetSessionScopedKeys(store: Storage) {
  for (const key of SESSION_SCOPED) store.removeItem(persistedKey(key))
}
