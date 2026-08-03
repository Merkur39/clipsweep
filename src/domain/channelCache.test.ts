// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { channelCache, lookupChannel, rememberChannel } from './channelCache'

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const cacheOf = (...entries: [string, string][]) =>
  JSON.stringify(entries.map(([login, createdAt]) => ({ login, createdAt })))

const logins = (raw: string) => (JSON.parse(raw) as { login: string }[]).map((entry) => entry.login)

describe('lookupChannel', () => {
  it('finds nothing in a missing cache', () => {
    expect(lookupChannel(null, 'testchannel')).toBeNull()
  })

  it('returns the date of a known channel', () => {
    expect(lookupChannel(cacheOf(['testchannel', '2017-07-10']), 'testchannel')).toBe('2017-07-10')
  })

  it('returns nothing for an unknown channel', () => {
    expect(lookupChannel(cacheOf(['testchannel', '2017-07-10']), 'other')).toBeNull()
  })

  it('ignores case and whitespace in the input', () => {
    expect(lookupChannel(cacheOf(['testchannel', '2017-07-10']), '  TestChannel ')).toBe(
      '2017-07-10',
    )
  })

  // The cache lives in browser storage: it may have been tampered with by hand.
  it('survives corrupt content rather than throwing', () => {
    for (const corrupt of ['not json', '{}', '[1,2,3]', '[{"login":"a"}]', '']) {
      expect(lookupChannel(corrupt, 'a')).toBeNull()
    }
  })
})

describe('rememberChannel', () => {
  it('creates the cache on the first channel', () => {
    const raw = rememberChannel(null, 'testchannel', '2017-07-10')

    expect(lookupChannel(raw, 'testchannel')).toBe('2017-07-10')
  })

  it('keeps the channels already known', () => {
    const raw = rememberChannel(cacheOf(['older', '2015-01-01']), 'testchannel', '2017-07-10')

    expect(lookupChannel(raw, 'older')).toBe('2015-01-01')
    expect(lookupChannel(raw, 'testchannel')).toBe('2017-07-10')
  })

  it('does not duplicate a channel already present', () => {
    const raw = rememberChannel(cacheOf(['testchannel', '2017-07-10']), 'testchannel', '2017-07-10')

    expect(logins(raw)).toEqual(['testchannel'])
  })

  it('normalizes the stored login', () => {
    const raw = rememberChannel(null, '  TestChannel ', '2017-07-10')

    expect(logins(raw)).toEqual(['testchannel'])
  })

  it('pushes the reused channel to the back of the queue', () => {
    let raw = rememberChannel(null, 'a', '2015-01-01')
    raw = rememberChannel(raw, 'b', '2016-01-01')
    raw = rememberChannel(raw, 'a', '2015-01-01')

    expect(logins(raw)).toEqual(['b', 'a'])
  })

  it('caps the cache by forgetting the oldest entries', () => {
    let raw: string | null = null
    for (const name of ['a', 'b', 'c']) raw = rememberChannel(raw, name, '2015-01-01', 2)

    expect(logins(raw!)).toEqual(['b', 'c'])
  })

  it('starts from a sound cache even when the old one was corrupt', () => {
    const raw = rememberChannel('not json', 'testchannel', '2017-07-10')

    expect(lookupChannel(raw, 'testchannel')).toBe('2017-07-10')
  })
})

describe('channelCache', () => {
  it('reads back what it just stored', () => {
    channelCache.remember('testchannel', '2017-07-10')

    expect(channelCache.read('testchannel')).toBe('2017-07-10')
  })

  it('does not know a channel never stored', () => {
    expect(channelCache.read('testchannel')).toBeNull()
  })

  // The cache travels with the sweep fields, which live for the tab's lifetime:
  // leaving it in localStorage would leave the trace of visited channels there
  // long after the session that searched for them has ended.
  it('lives in sessionStorage, leaving nothing in localStorage', () => {
    channelCache.remember('testchannel', '2017-07-10')

    expect(sessionStorage.getItem('getclip.channels')).toContain('testchannel')
    expect(localStorage.getItem('getclip.channels')).toBeNull()
  })
})
