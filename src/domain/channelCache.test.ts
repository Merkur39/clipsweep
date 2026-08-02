import { describe, expect, it } from 'vitest'

import { lookupChannel, rememberChannel } from './channelCache'

const cacheDe = (...entrees: [string, string][]) =>
  JSON.stringify(entrees.map(([login, createdAt]) => ({ login, createdAt })))

const logins = (raw: string) =>
  (JSON.parse(raw) as { login: string }[]).map((entree) => entree.login)

describe('lookupChannel', () => {
  it('ne trouve rien dans un cache absent', () => {
    expect(lookupChannel(null, 'testchannel')).toBeNull()
  })

  it('rend la date d’une chaîne connue', () => {
    expect(lookupChannel(cacheDe(['testchannel', '2017-07-10']), 'testchannel')).toBe('2017-07-10')
  })

  it('ne rend rien pour une chaîne inconnue', () => {
    expect(lookupChannel(cacheDe(['testchannel', '2017-07-10']), 'autre')).toBeNull()
  })

  it('ignore la casse et les espaces de la saisie', () => {
    expect(lookupChannel(cacheDe(['testchannel', '2017-07-10']), '  TestChannel ')).toBe(
      '2017-07-10',
    )
  })

  // Le cache vit en localStorage : il peut avoir été trituré à la main.
  it('survit à un contenu corrompu plutôt que de lever', () => {
    for (const corrompu of ['pas du json', '{}', '[1,2,3]', '[{"login":"a"}]', '']) {
      expect(lookupChannel(corrompu, 'a')).toBeNull()
    }
  })
})

describe('rememberChannel', () => {
  it('crée le cache à la première chaîne', () => {
    const raw = rememberChannel(null, 'testchannel', '2017-07-10')

    expect(lookupChannel(raw, 'testchannel')).toBe('2017-07-10')
  })

  it('conserve les chaînes déjà connues', () => {
    const raw = rememberChannel(cacheDe(['ancienne', '2015-01-01']), 'testchannel', '2017-07-10')

    expect(lookupChannel(raw, 'ancienne')).toBe('2015-01-01')
    expect(lookupChannel(raw, 'testchannel')).toBe('2017-07-10')
  })

  it('ne duplique pas une chaîne déjà présente', () => {
    const raw = rememberChannel(cacheDe(['testchannel', '2017-07-10']), 'testchannel', '2017-07-10')

    expect(logins(raw)).toEqual(['testchannel'])
  })

  it('normalise le login enregistré', () => {
    const raw = rememberChannel(null, '  TestChannel ', '2017-07-10')

    expect(logins(raw)).toEqual(['testchannel'])
  })

  it('repousse la chaîne réutilisée en fin de file', () => {
    let raw = rememberChannel(null, 'a', '2015-01-01')
    raw = rememberChannel(raw, 'b', '2016-01-01')
    raw = rememberChannel(raw, 'a', '2015-01-01')

    expect(logins(raw)).toEqual(['b', 'a'])
  })

  it('plafonne le cache en oubliant les plus anciennes', () => {
    let raw: string | null = null
    for (const nom of ['a', 'b', 'c']) raw = rememberChannel(raw, nom, '2015-01-01', 2)

    expect(logins(raw!)).toEqual(['b', 'c'])
  })

  it('repart d’un cache sain même si l’ancien était corrompu', () => {
    const raw = rememberChannel('pas du json', 'testchannel', '2017-07-10')

    expect(lookupChannel(raw, 'testchannel')).toBe('2017-07-10')
  })
})
