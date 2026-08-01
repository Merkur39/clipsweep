import { describe, expect, it } from 'vitest'

import { bisect, splitRange, windowDurationMs } from './windows'

const iso = (s: string) => new Date(s)

describe('splitRange', () => {
  it('splits a range into contiguous chunks of the requested size', () => {
    const windows = splitRange(
      iso('2024-01-01T00:00:00Z'),
      iso('2024-01-07T00:00:00Z'),
      2 * 86_400_000,
    )

    expect(windows).toEqual([
      { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-03T00:00:00Z' },
      { startedAt: '2024-01-03T00:00:00Z', endedAt: '2024-01-05T00:00:00Z' },
      { startedAt: '2024-01-05T00:00:00Z', endedAt: '2024-01-07T00:00:00Z' },
    ])
  })

  it('truncates the last chunk to the end of the range', () => {
    const windows = splitRange(
      iso('2024-01-01T00:00:00Z'),
      iso('2024-01-04T00:00:00Z'),
      2 * 86_400_000,
    )

    expect(windows).toHaveLength(2)
    expect(windows[1]).toEqual({
      startedAt: '2024-01-03T00:00:00Z',
      endedAt: '2024-01-04T00:00:00Z',
    })
  })

  it('returns a single window when the range is shorter than a chunk', () => {
    const windows = splitRange(
      iso('2024-01-01T00:00:00Z'),
      iso('2024-01-02T00:00:00Z'),
      30 * 86_400_000,
    )

    expect(windows).toEqual([
      { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-02T00:00:00Z' },
    ])
  })

  it('returns no window when the range is empty or inverted', () => {
    expect(
      splitRange(iso('2024-01-02T00:00:00Z'), iso('2024-01-02T00:00:00Z'), 86_400_000),
    ).toEqual([])
    expect(
      splitRange(iso('2024-01-03T00:00:00Z'), iso('2024-01-02T00:00:00Z'), 86_400_000),
    ).toEqual([])
  })
})

describe('bisect', () => {
  it('cuts a window in two contiguous halves', () => {
    const halves = bisect(
      { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-03T00:00:00Z' },
      3_600_000,
    )

    expect(halves).toEqual([
      { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-02T00:00:00Z' },
      { startedAt: '2024-01-02T00:00:00Z', endedAt: '2024-01-03T00:00:00Z' },
    ])
  })

  it('refuses to cut below twice the minimum window size', () => {
    const oneHour = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-01T01:00:00Z' }

    expect(bisect(oneHour, 3_600_000)).toBeNull()
  })
})

describe('windowDurationMs', () => {
  it('measures the window span in milliseconds', () => {
    expect(
      windowDurationMs({ startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-01T06:00:00Z' }),
    ).toBe(21_600_000)
  })
})
