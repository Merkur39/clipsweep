import { describe, expect, it } from 'vitest'

import {
  CEILING_BAND,
  checkCeiling,
  checkCursorShape,
  checkSortOrder,
  checkTokenLifetime,
  renderIssue,
  summarize,
  type Verdict,
} from './assumptions.ts'

/** A cursor as Helix encodes it today: base64 JSON wrapping a base64 offset. */
function encodeCursor(offset: number): string {
  const inner = Buffer.from(String(offset)).toString('base64')
  return Buffer.from(JSON.stringify({ b: null, a: { Cursor: inner } })).toString('base64')
}

function verdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    id: 'sort-order',
    claim: 'claim',
    status: 'holds',
    severity: 'critical',
    detail: 'detail',
    ...overrides,
  }
}

describe('checkSortOrder', () => {
  it('holds on a strictly descending run of view counts', () => {
    expect(checkSortOrder([900, 512, 512, 43, 1]).status).toBe('holds')
  })

  it('drifts on the first count higher than the one before it', () => {
    const result = checkSortOrder([900, 512, 700, 43])

    expect(result.status).toBe('drifted')
    expect(result.detail).toContain('512')
    expect(result.detail).toContain('700')
  })

  it('reports the position of the inversion, so the page it fell on is findable', () => {
    expect(checkSortOrder([50, 40, 41]).detail).toContain('2')
  })
})

describe('checkCeiling', () => {
  it('holds when the walk stops inside the band', () => {
    expect(checkCeiling(1006, CEILING_BAND).status).toBe('holds')
  })

  it('drifts when the walk goes past the band, and says the cap was raised', () => {
    const result = checkCeiling(5000, CEILING_BAND)

    expect(result.status).toBe('drifted')
    expect(result.detail).toMatch(/raised/)
  })

  it('drifts when the walk stops short, naming both possible causes', () => {
    const result = checkCeiling(300, CEILING_BAND)

    expect(result.status).toBe('drifted')
    // A short walk is ambiguous: lowered cap, or a probe channel too small.
    expect(result.detail).toMatch(/probe channel/)
  })
})

describe('checkCursorShape', () => {
  it('holds when the cursor decodes to the number of items already consumed', () => {
    expect(checkCursorShape(encodeCursor(100), 100).status).toBe('holds')
  })

  it('drifts when the decoded offset disagrees with what was consumed', () => {
    expect(checkCursorShape(encodeCursor(24), 100).status).toBe('drifted')
  })

  it('drifts when the cursor stops being base64 JSON at all', () => {
    expect(checkCursorShape('not-a-cursor', 100).status).toBe('drifted')
  })

  it('drifts when the JSON no longer carries the expected shape', () => {
    const cursor = Buffer.from(JSON.stringify({ next: 'abc' })).toString('base64')

    expect(checkCursorShape(cursor, 100).status).toBe('drifted')
  })

  it('stays informational: the tool treats the cursor as opaque', () => {
    expect(checkCursorShape('not-a-cursor', 100).severity).toBe('info')
  })
})

describe('checkTokenLifetime', () => {
  it('holds around the sixty days observed so far', () => {
    expect(checkTokenLifetime(60 * 86_400).status).toBe('holds')
  })

  it('drifts when the lifetime collapses to hours', () => {
    const result = checkTokenLifetime(4 * 3600)

    expect(result.status).toBe('drifted')
    expect(result.severity).toBe('info')
  })
})

describe('summarize', () => {
  it('does not alert while every assumption holds', () => {
    expect(summarize([verdict(), verdict({ id: 'cursor-shape' })]).shouldAlert).toBe(false)
  })

  it('alerts on any drift, whatever its severity', () => {
    const drifted = [verdict({ id: 'cursor-shape', severity: 'info', status: 'drifted' })]

    expect(summarize(drifted).shouldAlert).toBe(true)
  })

  it('marks the failing ids in a stable order, so two runs compare', () => {
    const one = summarize([
      verdict({ id: 'pagination-ceiling', status: 'drifted' }),
      verdict({ id: 'cursor-shape', status: 'drifted' }),
    ])
    const other = summarize([
      verdict({ id: 'cursor-shape', status: 'drifted' }),
      verdict({ id: 'pagination-ceiling', status: 'drifted' }),
    ])

    expect(one.marker).toBe(other.marker)
    expect(one.marker).toContain('cursor-shape')
  })

  it('keeps the marker of a green run distinct from any drifting one', () => {
    expect(summarize([verdict()]).marker).not.toBe(
      summarize([verdict({ status: 'drifted' })]).marker,
    )
  })
})

describe('renderIssue', () => {
  const context = { channel: 'somechannel', checkedAt: '2026-08-14', runUrl: 'https://run' }

  it('names the drifting assumptions in the title, not the healthy ones', () => {
    const { title } = renderIssue(
      [verdict({ id: 'sort-order', status: 'drifted' }), verdict({ id: 'cursor-shape' })],
      context,
    )

    expect(title).toContain('sort-order')
    expect(title).not.toContain('cursor-shape')
  })

  it('carries the marker, so a later run can tell whether anything changed', () => {
    const verdicts = [verdict({ status: 'drifted' })]
    const { body } = renderIssue(verdicts, context)

    expect(body).toContain(summarize(verdicts).marker)
  })

  it('states what was measured and where, so the issue stands on its own', () => {
    const { body } = renderIssue(
      [verdict({ status: 'drifted', detail: 'a precise measurement' })],
      context,
    )

    expect(body).toContain('a precise measurement')
    expect(body).toContain('somechannel')
    expect(body).toContain('https://run')
  })

  it('lists the assumptions that still hold, so the issue is not read as total loss', () => {
    const { body } = renderIssue(
      [verdict({ id: 'sort-order', status: 'drifted' }), verdict({ id: 'cursor-shape' })],
      context,
    )

    expect(body).toContain('cursor-shape')
  })
})
