import type { Clip } from './types'

/** `TwitchApi.fetchGameNames`, which says what `incomplete` does and does not mean. */
export type GameNameFetcher = (
  ids: string[],
) => Promise<{ names: ReadonlyMap<string, string>; incomplete: boolean }>

export interface GameNameResolver {
  /** Asks about every game these clips were played on that nothing has asked about yet. */
  add: (clips: readonly Clip[]) => void
  /**
   * Resolves once every game handed to `add` so far has been asked about, and
   * says whether some batch was lost on the way. A stop is not a loss: what it
   * leaves unnamed was never asked about.
   */
  settled: () => Promise<{ incomplete: boolean }>
}

/**
 * Names the games of a sweep as its clips come in, rather than once it is over.
 *
 * The creator facet is legible from the first page, the name being on the clip
 * itself. The game facet only has an id to go on, and it used to wait for the
 * end of the sweep before asking what those ids were called — the verification
 * included, which is most of a sweep over a large channel — so every game in it
 * read "Unnamed" until then, which is what a retired category looks like.
 *
 * One request in flight at a time, and whatever arrives meanwhile goes out
 * together in the next one: a request per delivery would take a slot of the
 * sweep's own spacing gate each time, for a game or two, where holding them
 * back costs one round trip. What comes back is kept whether it is whole or
 * not, as the client already does per batch — these names label a filter, and
 * losing some of them is no reason to fail anything.
 *
 * A stop calls off the requests, not just the sweep: nothing is asked once the
 * signal is aborted, and what was named before it stays named.
 */
export function createGameNameResolver(
  fetchNames: GameNameFetcher,
  onNames: (names: ReadonlyMap<string, string>) => void,
  signal?: AbortSignal,
): GameNameResolver {
  const asked = new Set<string>()
  const names = new Map<string, string>()
  let queued: string[] = []
  let incomplete = false
  // Set and cleared inside `drain` itself, synchronously, rather than read off
  // a promise settling: a game added between the loop running dry and a
  // `finally` callback clearing a flag would sit in the queue with nothing left
  // to send it.
  let asking = false
  let drained: Promise<void> = Promise.resolve()

  const drain = async () => {
    asking = true
    try {
      while (queued.length > 0 && !signal?.aborted) {
        const batch = queued
        queued = []
        try {
          const answer = await fetchNames(batch)
          for (const [id, name] of answer.names) names.set(id, name)
          incomplete = incomplete || answer.incomplete
          // A copy: the caller keeps what it is handed, and this map goes on
          // growing under it.
          onNames(new Map(names))
        } catch (cause) {
          if ((cause as Error).name === 'AbortError') return
          incomplete = true
        }
      }
    } finally {
      asking = false
    }
  }

  return {
    add(clips) {
      for (const { game_id: id } of clips) {
        if (id && !asked.has(id)) {
          asked.add(id)
          queued.push(id)
        }
      }
      if (!asking && queued.length > 0) drained = drain()
    },
    async settled() {
      await drained
      return { incomplete }
    },
  }
}
