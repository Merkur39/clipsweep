import { describe, expect, it } from 'vitest'

import { makeLogAppender, type LogEntry } from './log'
import { makeT } from '../i18n/translate'

const t = makeT('fr')
/** Entries hold a message, not a string: reading one is rendering it. */
const said = (entries: LogEntry[]) => entries.map((entry) => entry.say(t))
/** A line whose text is its own, standing in for a real catalogue message. */
const line = (text: string) => () => text

const apply = (entries: LogEntry[], updaters: ((entries: LogEntry[]) => LogEntry[])[]) =>
  updaters.reduce((accumulator, updater) => updater(accumulator), entries)

describe('makeLogAppender', () => {
  it('appends an entry', () => {
    const append = makeLogAppender(10)

    const kept = apply([], [append(line('hello'), 'good')])

    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({ id: 1, kind: 'good' })
    expect(said(kept)).toEqual(['hello'])
  })

  it('gives distinct ids to entries queued in the same tick', () => {
    const append = makeLogAppender(10)

    // React defers updaters to the flush: the id must be settled at call time,
    // not read back from a counter that has moved on since.
    const updaters = [append(line('one')), append(line('two')), append(line('three'))]

    expect(apply([], updaters).map((entry) => entry.id)).toEqual([1, 2, 3])
  })

  it('drops the oldest entries past the limit', () => {
    const append = makeLogAppender(2)

    const kept = apply([], [append(line('one')), append(line('two')), append(line('three'))])

    expect(said(kept)).toEqual(['two', 'three'])
  })

  it('defaults to the neutral kind', () => {
    expect(apply([], [makeLogAppender(10)(line('raw'))])[0].kind).toBe('info')
  })
})
