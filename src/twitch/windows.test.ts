import { describe, expect, it } from 'vitest'

import { bisect, seedWindows } from './windows'

const iso = (s: string) => new Date(s)

describe('seedWindows', () => {
  // Measured on 2026-09-20: a narrower date range makes Helix under-deliver. On
  // `kaliyami`, 2025 as one window returned 253 clips where the same span cut
  // into quarters or months returned 249 — the very same 249, four short, and
  // never a clip the wide window had missed. So the seed is as wide as the
  // period, and only saturation buys a cut.
  it('seeds one window spanning the whole period', () => {
    expect(seedWindows(iso('2019-06-15T00:00:00Z'), iso('2021-03-10T00:00:00Z'))).toEqual([
      { startedAt: '2019-06-15T00:00:00Z', endedAt: '2021-03-10T00:00:00Z' },
    ])
  })

  it('crosses calendar years without cutting on them', () => {
    const windows = seedWindows(iso('2019-06-15T00:00:00Z'), iso('2026-01-01T00:00:00Z'))

    expect(windows).toHaveLength(1)
    expect(windows[0]).toEqual({
      startedAt: '2019-06-15T00:00:00Z',
      endedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('drops the milliseconds Twitch rejects', () => {
    expect(seedWindows(iso('2019-06-15T00:00:00.250Z'), iso('2021-03-10T12:30:45.999Z'))).toEqual([
      { startedAt: '2019-06-15T00:00:00Z', endedAt: '2021-03-10T12:30:45Z' },
    ])
  })

  it('returns nothing for an empty or inverted range', () => {
    expect(seedWindows(iso('2020-01-01T00:00:00Z'), iso('2020-01-01T00:00:00Z'))).toEqual([])
    expect(seedWindows(iso('2021-01-01T00:00:00Z'), iso('2020-01-01T00:00:00Z'))).toEqual([])
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
