// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { forgetSessionScopedKeys, persistedKey, usePersistedState } from './usePersistedState'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

describe('usePersistedState', () => {
  it('part de la valeur initiale faute d’entrée enregistrée', () => {
    const { result } = renderHook(() => usePersistedState('channel', 'defaut'))

    expect(result.current[0]).toBe('defaut')
  })

  it('reprend la valeur enregistrée sous la clé préfixée', () => {
    localStorage.setItem('getclip.channel', 'gardee')

    const { result } = renderHook(() => usePersistedState('channel', 'defaut'))

    expect(result.current[0]).toBe('gardee')
  })

  it('enregistre chaque nouvelle valeur', () => {
    const { result } = renderHook(() => usePersistedState('channel', 'defaut'))

    act(() => result.current[1]('saisie'))

    expect(localStorage.getItem('getclip.channel')).toBe('saisie')
  })

  // Le thème est une préférence durable : elle doit survivre à la fermeture de
  // l'onglet, et `main.tsx` la relit sous cette même clé avant le premier rendu.
  it('écrit en localStorage par défaut', () => {
    renderHook(() => usePersistedState('theme', 'dark'))

    expect(localStorage.getItem('getclip.theme')).toBe('dark')
    expect(sessionStorage.getItem('getclip.theme')).toBeNull()
  })

  // Ce qui vise une fouille — chaîne et période — n'a pas à survivre à l'onglet :
  // retrouver la cible d'hier ferait repartir une fouille qu'on n'a pas choisie.
  it('écrit dans le stockage qu’on lui donne, sans toucher à l’autre', () => {
    renderHook(() => usePersistedState('channel', 'saisie', sessionStorage))

    expect(sessionStorage.getItem('getclip.channel')).toBe('saisie')
    expect(localStorage.getItem('getclip.channel')).toBeNull()
  })

  it('relit le stockage qu’on lui donne', () => {
    sessionStorage.setItem('getclip.since', '2026-07-02')

    const { result } = renderHook(() => usePersistedState('since', '2019-01-01', sessionStorage))

    expect(result.current[0]).toBe('2026-07-02')
  })

  it('préfixe les clés pour ne pas piétiner le reste du domaine', () => {
    expect(persistedKey('channel')).toBe('getclip.channel')
  })
})

// Ces clés ont vécu en localStorage jusqu'au 2026-08-02. Les cesser de les lire
// ne les efface pas : sans cette purge, la chaîne visitée et la période d'alors
// resteraient sur la machine du visiteur, indéfiniment et sans plus servir à
// rien — l'inverse de ce que le passage en sessionStorage cherche.
describe('forgetSessionScopedKeys', () => {
  it('efface les clés qui ne relèvent plus du stockage durable', () => {
    const orphelines = ['getclip.channel', 'getclip.channels', 'getclip.since', 'getclip.until']
    for (const key of orphelines) localStorage.setItem(key, 'reliquat')

    forgetSessionScopedKeys(localStorage)

    expect(orphelines.map((key) => localStorage.getItem(key))).toEqual([null, null, null, null])
    expect(localStorage.length).toBe(0)
  })

  it('ne touche pas au thème, qui est une préférence durable', () => {
    localStorage.setItem('getclip.theme', 'dark')

    forgetSessionScopedKeys(localStorage)

    expect(localStorage.getItem('getclip.theme')).toBe('dark')
  })

  it('laisse intact ce qui n’appartient pas à l’application', () => {
    localStorage.setItem('channel', 'à quelqu’un d’autre')

    forgetSessionScopedKeys(localStorage)

    expect(localStorage.getItem('channel')).toBe('à quelqu’un d’autre')
  })
})
