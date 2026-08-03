import { describe, expect, it, vi } from 'vitest'

import { collectClips } from './clips'
import type { Clip, ClipPage } from './types'
import type { DateWindow } from './windows'

const clip = (id: string, viewCount = 1, createdAt = '2024-01-01T00:00:00Z'): Clip => ({
  id,
  url: `https://clips.twitch.tv/${id}`,
  embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
  title: id,
  view_count: viewCount,
  created_at: createdAt,
  thumbnail_url: '',
  duration: 30,
  creator_name: 'someone',
  broadcaster_name: 'testchannel',
  game_id: '1',
})

const key = (w: DateWindow) => `${w.startedAt}|${w.endedAt}`

const twoDays: DateWindow = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-03T00:00:00Z' }
const firstHalf: DateWindow = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-02T00:00:00Z' }
const secondHalf: DateWindow = {
  startedAt: '2024-01-02T00:00:00Z',
  endedAt: '2024-01-03T00:00:00Z',
}
const oneHour: DateWindow = { startedAt: '2024-01-01T00:00:00Z', endedAt: '2024-01-01T01:00:00Z' }

describe('collectClips, diffusion au fil de l’eau', () => {
  // Un scan dure de quelques secondes à plusieurs minutes : garder les clips
  // pour la fin laisse la table vide — donc menteuse — pendant tout ce temps.
  it('livre les clips après chaque période, sans attendre la fin', async () => {
    const pages: Record<string, ClipPage> = {
      [key(firstHalf)]: { clips: [clip('a'), clip('b')], cursor: undefined },
      [key(secondHalf)]: { clips: [clip('c')], cursor: undefined },
    }
    const onClips = vi.fn()

    await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage: async (window) => pages[key(window)],
      onClips,
    })

    expect(onClips.mock.calls.map(([clips]) => clips.map((c: Clip) => c.id))).toEqual([
      ['a', 'b'],
      ['a', 'b', 'c'],
    ])
  })

  // Le même clip revient d'une moitié à l'autre après un recoupage : le flux
  // doit sortir dédoublonné, sinon la table double des lignes puis les retire.
  it('diffuse déjà dédoublonné', async () => {
    const pages: Record<string, ClipPage> = {
      [key(firstHalf)]: { clips: [clip('a')], cursor: undefined },
      [key(secondHalf)]: { clips: [clip('a'), clip('b')], cursor: undefined },
    }
    const onClips = vi.fn()

    await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage: async (window) => pages[key(window)],
      onClips,
    })

    expect(onClips.mock.lastCall?.[0].map((c: Clip) => c.id)).toEqual(['a', 'b'])
  })

  it('livre le même contenu que le résultat final', async () => {
    const pages: Record<string, ClipPage> = {
      [key(firstHalf)]: { clips: [clip('a')], cursor: undefined },
      [key(secondHalf)]: { clips: [clip('b')], cursor: undefined },
    }
    const onClips = vi.fn()

    const result = await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage: async (window) => pages[key(window)],
      onClips,
    })

    expect(onClips.mock.lastCall?.[0]).toEqual(result.clips)
  })
})

describe('collectClips', () => {
  it('follows the cursor until the window is exhausted', async () => {
    const pages: ClipPage[] = [
      { clips: [clip('a'), clip('b')], cursor: 'p2' },
      { clips: [clip('c')], cursor: undefined },
    ]
    const fetchPage = vi.fn(async () => pages.shift()!)

    const { clips, requests } = await collectClips({ windows: [twoDays], fetchPage })

    expect(clips.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(requests).toBe(2)
    expect(fetchPage).toHaveBeenLastCalledWith(twoDays, 'p2')
  })

  it('deduplicates clips returned by overlapping windows', async () => {
    const fetchPage = vi.fn(async () => ({ clips: [clip('a'), clip('b')] }))

    const { clips } = await collectClips({ windows: [firstHalf, secondHalf], fetchPage })

    expect(clips.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('bisects a saturated window and explores the halves depth-first', async () => {
    const fetchPage = vi.fn(async (window: DateWindow): Promise<ClipPage> => {
      if (key(window) === key(twoDays)) return { clips: [clip('a'), clip('b')], cursor: 'more' }
      if (key(window) === key(firstHalf)) return { clips: [clip('a'), clip('b')] }
      return { clips: [clip('c')] }
    })

    const { clips, reports, incomplete } = await collectClips({
      windows: [twoDays, oneHour],
      fetchPage,
      pageCap: 2,
    })

    expect(clips.map((c) => c.id).sort()).toEqual(['a', 'b', 'c'])
    // The halves are visited before moving on to the next top-level window.
    expect(fetchPage.mock.calls.map(([w]) => key(w))).toEqual([
      key(twoDays),
      key(firstHalf),
      key(secondHalf),
      key(oneHour),
    ])
    expect(reports.find((r) => key(r.window) === key(twoDays))).toMatchObject({
      saturated: true,
      split: true,
      depth: 0,
    })
    expect(reports.find((r) => key(r.window) === key(firstHalf))).toMatchObject({
      split: false,
      depth: 1,
    })
    expect(incomplete).toEqual([])
  })

  it('reports a window still saturated at the minimum size as incomplete', async () => {
    const fetchPage = vi.fn(async () => ({ clips: [clip('a')], cursor: 'more' }))

    const { incomplete, reports } = await collectClips({
      windows: [oneHour],
      fetchPage,
      pageCap: 1,
      minWindowMs: 3_600_000,
    })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(incomplete).toHaveLength(1)
    expect(incomplete[0]).toMatchObject({ window: oneHour, saturated: true, split: false })
    expect(reports).toEqual(incomplete)
  })

  it('reports progress as windows are consumed', async () => {
    const onProgress = vi.fn()
    const fetchPage = vi.fn(async () => ({ clips: [clip('a')] }))

    await collectClips({ windows: [firstHalf, secondHalf], fetchPage, onProgress })

    expect(onProgress).toHaveBeenLastCalledWith({
      windowsDone: 2,
      windowsTotal: 2,
      clipsFound: 1,
      requests: 2,
    })
  })

  it('stops early when the signal is aborted', async () => {
    const controller = new AbortController()
    const fetchPage = vi.fn(async () => {
      controller.abort()
      return { clips: [clip('a')] }
    })

    const { clips } = await collectClips({
      windows: [firstHalf, secondHalf],
      fetchPage,
      signal: controller.signal,
    })

    expect(clips.map((c) => c.id)).toEqual(['a'])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
