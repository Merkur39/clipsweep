import { describe, expect, it } from 'vitest'

import { makeLogAppender, type LogEntry } from './log'

const apply = (entries: LogEntry[], updaters: ((entries: LogEntry[]) => LogEntry[])[]) =>
  updaters.reduce((accumulator, updater) => updater(accumulator), entries)

describe('makeLogAppender', () => {
  it('appends an entry', () => {
    const append = makeLogAppender(10)

    expect(apply([], [append('bonjour', 'good')])).toEqual([{ id: 1, kind: 'good', text: 'bonjour' }])
  })

  it('gives distinct ids to entries queued in the same tick', () => {
    const append = makeLogAppender(10)

    // React defers updaters to the flush: the id must be settled at call time,
    // not read back from a counter that has moved on since.
    const updaters = [append('un'), append('deux'), append('trois')]

    expect(apply([], updaters).map((entry) => entry.id)).toEqual([1, 2, 3])
  })

  it('drops the oldest entries past the limit', () => {
    const append = makeLogAppender(2)

    const kept = apply([], [append('un'), append('deux'), append('trois')])

    expect(kept.map((entry) => entry.text)).toEqual(['deux', 'trois'])
  })

  it('defaults to the neutral kind', () => {
    expect(apply([], [makeLogAppender(10)('brut')])[0].kind).toBe('info')
  })
})
