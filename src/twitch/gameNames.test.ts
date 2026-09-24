import { describe, expect, it, vi } from 'vitest'

import { createGameNameResolver } from './gameNames'
import type { Clip } from './types'

const CATALOGUE: Record<string, string> = {
  '1': 'Cult of the Lamb',
  '2': 'Hollow Knight',
  '3': 'Celeste',
}

/** A clip, as far as naming its game is concerned. */
const on = (gameId: string) => ({ game_id: gameId }) as Clip

/** What Helix answers: the ids it was asked about, and only those it knows. */
const answer = (ids: string[], incomplete = false) => ({
  names: new Map(ids.filter((id) => id in CATALOGUE).map((id) => [id, CATALOGUE[id]])),
  incomplete,
})

/** A client whose every answer waits until the test lets it land. */
function heldClient() {
  const pending: (() => void)[] = []
  const fetchNames = vi.fn(
    (ids: string[]) =>
      new Promise<ReturnType<typeof answer>>((resolve) => {
        pending.push(() => resolve(answer(ids)))
      }),
  )
  return { fetchNames, land: () => pending.shift()?.() }
}

const aborted = () => new DOMException('Aborted', 'AbortError')

describe('createGameNameResolver', () => {
  it('asks about the games of the first clips it is handed, without waiting for more', async () => {
    const fetchNames = vi.fn(async (ids: string[]) => answer(ids))
    const onNames = vi.fn()
    const games = createGameNameResolver(fetchNames, onNames)

    games.add([on('1')])

    expect(await games.settled()).toEqual({ incomplete: false })
    expect(fetchNames).toHaveBeenCalledWith(['1'])
    expect(onNames).toHaveBeenLastCalledWith(new Map([['1', 'Cult of the Lamb']]))
  })

  it('never asks twice about the same game', async () => {
    const fetchNames = vi.fn(async (ids: string[]) => answer(ids))
    const games = createGameNameResolver(fetchNames, vi.fn())

    games.add([on('1'), on('1')])
    await games.settled()
    games.add([on('1'), on('2')])
    await games.settled()

    expect(fetchNames.mock.calls).toEqual([[['1']], [['2']]])
  })

  // A delivery brings a game or two. One request each would spend a slot of the
  // sweep's own gate per delivery, where holding them costs one round trip.
  it('sends what arrives during a request together, once that request is back', async () => {
    const { fetchNames, land } = heldClient()
    const games = createGameNameResolver(fetchNames, vi.fn())

    games.add([on('1')])
    games.add([on('2')])
    games.add([on('3')])
    expect(fetchNames).toHaveBeenCalledTimes(1)

    land()
    await vi.waitFor(() => expect(fetchNames).toHaveBeenCalledTimes(2))
    expect(fetchNames.mock.calls[1]).toEqual([['2', '3']])
  })

  it('settles once every game handed to it has been asked about', async () => {
    const { fetchNames, land } = heldClient()
    const onNames = vi.fn()
    const games = createGameNameResolver(fetchNames, onNames)
    games.add([on('1')])
    games.add([on('2')])

    let settled = false
    const done = games.settled().then(() => (settled = true))
    land()
    await vi.waitFor(() => expect(fetchNames).toHaveBeenCalledTimes(2))
    expect(settled).toBe(false)

    land()
    await done
    expect(onNames).toHaveBeenLastCalledWith(
      new Map([
        ['1', 'Cult of the Lamb'],
        ['2', 'Hollow Knight'],
      ]),
    )
  })

  it('says a batch was lost, once everything asked has come back', async () => {
    const games = createGameNameResolver(async (ids) => answer(ids, ids.includes('2')), vi.fn())

    games.add([on('1')])
    await games.settled()
    games.add([on('2')])

    expect(await games.settled()).toEqual({ incomplete: true })
  })

  // `fetchGameNames` folds a failed batch into `incomplete` and only ever throws
  // an abort; anything else getting through is a request lost all the same, and
  // must not take the games still to come down with it.
  it('counts a request that fails outright as a loss, and goes on asking', async () => {
    const fetchNames = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockImplementation(async (ids: string[]) => answer(ids))
    const onNames = vi.fn()
    const games = createGameNameResolver(fetchNames, onNames)

    games.add([on('1')])
    expect(await games.settled()).toEqual({ incomplete: true })
    games.add([on('2')])
    await games.settled()

    expect(onNames).toHaveBeenLastCalledWith(new Map([['2', 'Hollow Knight']]))
  })

  it('asks nothing once the search is stopped, and keeps the names it had', async () => {
    const controller = new AbortController()
    const fetchNames = vi.fn(async (ids: string[]) => answer(ids))
    const onNames = vi.fn()
    const games = createGameNameResolver(fetchNames, onNames, controller.signal)
    games.add([on('1')])
    await games.settled()

    controller.abort()
    games.add([on('2')])

    expect(await games.settled()).toEqual({ incomplete: false })
    expect(fetchNames).toHaveBeenCalledTimes(1)
    expect(onNames).toHaveBeenLastCalledWith(new Map([['1', 'Cult of the Lamb']]))
  })

  it('lets a stop cut the request in flight without calling it a loss', async () => {
    const controller = new AbortController()
    const fetchNames = vi.fn(
      () =>
        new Promise<ReturnType<typeof answer>>((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(aborted())),
        ),
    )
    const games = createGameNameResolver(fetchNames, vi.fn(), controller.signal)
    games.add([on('1')])
    games.add([on('2')])

    controller.abort()

    expect(await games.settled()).toEqual({ incomplete: false })
    // The game queued behind the request never went out.
    expect(fetchNames).toHaveBeenCalledTimes(1)
  })

  it('asks nothing about a clip filed under no game', async () => {
    const fetchNames = vi.fn(async (ids: string[]) => answer(ids))
    const games = createGameNameResolver(fetchNames, vi.fn())

    games.add([on('')])
    await games.settled()

    expect(fetchNames).not.toHaveBeenCalled()
  })
})
