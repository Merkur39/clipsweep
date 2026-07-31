import type { Clip, ClipPage, Progress } from './types'
import { bisect, type DateWindow } from './windows'

/**
 * Helix stops paginating past ~1000 results for a single clips query. We cut a
 * little under it: a window sitting exactly on the boundary is indistinguishable
 * from one that got truncated.
 */
export const DEFAULT_PAGE_CAP = 950
/** Below six hours, splitting costs more requests than the clips it recovers. */
export const DEFAULT_MIN_WINDOW_MS = 6 * 3_600_000

export type ClipPageFetcher = (window: DateWindow, cursor: string | undefined) => Promise<ClipPage>

export interface WindowReport {
  window: DateWindow
  depth: number
  clipCount: number
  /** Hit the result cap with pages still pending — some clips were unreachable. */
  saturated: boolean
  /** Saturated *and* small enough to be halved, so the gap gets covered. */
  split: boolean
}

export interface CollectResult {
  clips: Clip[]
  reports: WindowReport[]
  /** Saturated windows that could not be split: their surplus clips are lost. */
  incomplete: WindowReport[]
  requests: number
}

export interface CollectClipsOptions {
  windows: DateWindow[]
  fetchPage: ClipPageFetcher
  pageCap?: number
  minWindowMs?: number
  onProgress?: (progress: Progress) => void
  onWindow?: (report: WindowReport) => void
  signal?: AbortSignal
}

/**
 * Walks every window, following cursors, and halves any window that saturates —
 * otherwise the tail of the view-count ordering (the least viewed clips) stays
 * unreachable. Halves are explored depth-first so the timeline fills in order.
 */
export async function collectClips({
  windows,
  fetchPage,
  pageCap = DEFAULT_PAGE_CAP,
  minWindowMs = DEFAULT_MIN_WINDOW_MS,
  onProgress,
  onWindow,
  signal,
}: CollectClipsOptions): Promise<CollectResult> {
  const queue: { window: DateWindow; depth: number }[] = windows.map((window) => ({ window, depth: 0 }))
  const byId = new Map<string, Clip>()
  const reports: WindowReport[] = []
  let windowsDone = 0
  let windowsTotal = queue.length
  let requests = 0

  while (queue.length > 0 && !signal?.aborted) {
    const { window, depth } = queue.shift()!
    let cursor: string | undefined
    let collected = 0
    let saturated = false

    for (;;) {
      const page = await fetchPage(window, cursor)
      requests += 1
      for (const clip of page.clips) byId.set(clip.id, clip)
      collected += page.clips.length
      cursor = page.cursor

      if (signal?.aborted || !cursor || page.clips.length === 0) break
      if (collected >= pageCap) {
        saturated = true
        break
      }
    }

    const halves = saturated ? bisect(window, minWindowMs) : null
    if (halves) {
      // Depth-first: finish drilling into this span before the next one.
      queue.unshift(...halves.map((half) => ({ window: half, depth: depth + 1 })))
      windowsTotal += halves.length
    }

    const report: WindowReport = { window, depth, clipCount: collected, saturated, split: halves !== null }
    reports.push(report)
    onWindow?.(report)

    windowsDone += 1
    onProgress?.({ windowsDone, windowsTotal, clipsFound: byId.size, requests })
  }

  return {
    clips: [...byId.values()],
    reports,
    incomplete: reports.filter((report) => report.saturated && !report.split),
    requests,
  }
}

/** Keeps clips up to `maxViews` (all of them when null), least viewed first. */
export function filterByMaxViews(clips: Clip[], maxViews: number | null): Clip[] {
  const kept = maxViews === null ? [...clips] : clips.filter((clip) => clip.view_count <= maxViews)
  return kept.sort((a, b) => a.view_count - b.view_count || a.created_at.localeCompare(b.created_at))
}
