import { useEffect, useState } from 'react'

/** Exporté pour que `main.tsx` lise le thème sous la même clé, avant le rendu. */
export const persistedKey = (key: string) => `getclip.${key}`

/**
 * Un état de rendu adossé à un stockage du navigateur, relu au montage.
 *
 * Le stockage se choisit à l'appel, et ce choix est celui de la durée de vie :
 * `localStorage` pour une préférence qui doit survivre à l'onglet — le thème —,
 * `sessionStorage` pour ce qui ne vise qu'une fouille. Retrouver la chaîne et la
 * période d'une session close ferait repartir, au premier clic, une fouille que
 * personne n'a demandée dans cet onglet-ci.
 */
export function usePersistedState(key: string, initial: string, store: Storage = localStorage) {
  const [value, setValue] = useState(() => store.getItem(persistedKey(key)) ?? initial)
  useEffect(() => store.setItem(persistedKey(key), value), [key, store, value])
  return [value, setValue] as const
}

/** Ce qui vivait en `localStorage` jusqu'au 2026-08-02, et n'y a plus sa place. */
const SESSION_SCOPED = ['channel', 'channels', 'since', 'until']

/**
 * Efface d'un stockage durable les clés passées à la durée de vie de l'onglet.
 *
 * Cesser de les lire ne les efface pas : sans ce passage, la chaîne visitée et
 * la période cherchée d'alors resteraient sur la machine du visiteur, sans plus
 * servir à rien — l'inverse de ce que le changement cherchait. Le thème, lui,
 * est bien une préférence durable et reste.
 */
export function forgetSessionScopedKeys(store: Storage) {
  for (const key of SESSION_SCOPED) store.removeItem(persistedKey(key))
}
