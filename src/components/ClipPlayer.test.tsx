// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Clip } from '../twitch/types'
import { ClipPlayer } from './ClipPlayer'

afterEach(cleanup)

const clip = (id: string): Clip =>
  ({
    id,
    url: `https://www.twitch.tv/testchannel/clip/${id}`,
    embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
    broadcaster_name: 'TestChannel',
    creator_name: 'SpiZ',
    title: `Titre ${id}`,
    view_count: 12,
    created_at: '2026-01-15T00:00:00Z',
    thumbnail_url: '',
    duration: 30,
    game_id: '1',
  }) as Clip

const clips = [clip('a'), clip('b'), clip('c')]

const setup = (
  options: { playingId?: string | null; selected?: ReadonlySet<string>; clips?: Clip[] } = {},
) => {
  const onPlayingIdChange = vi.fn()
  const onToggle = vi.fn()
  const view = render(
    <ClipPlayer
      clips={options.clips ?? clips}
      playingId={options.playingId === undefined ? 'b' : options.playingId}
      onPlayingIdChange={onPlayingIdChange}
      selected={options.selected ?? new Set()}
      onToggle={onToggle}
    />,
  )
  return { onPlayingIdChange, onToggle, view }
}

const frame = () => document.querySelector('iframe')

describe('ClipPlayer, opening', () => {
  it('stays out of the way while nothing plays', () => {
    setup({ playingId: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(frame()).toBeNull()
  })

  it('plays the clip asked for, naming the embedding page', () => {
    setup()

    expect(screen.getByText('Titre b')).toBeInTheDocument()
    // jsdom serves the page from localhost, which is what Twitch must be told.
    expect(frame()?.getAttribute('src')).toBe(
      'https://clips.twitch.tv/embed?clip=b&parent=localhost&autoplay=false&muted=false',
    )
  })

  // Cross-origin, the iframe cannot be asked whether it managed to play: the way
  // out towards Twitch stays offered whatever happens inside it.
  it('offers the clip on Twitch too', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Ouvrir sur Twitch' })).toHaveAttribute(
      'href',
      'https://www.twitch.tv/testchannel/clip/b',
    )
  })

  it('closes on demand', () => {
    const { onPlayingIdChange } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onPlayingIdChange).toHaveBeenCalledWith(null)
  })

  /**
   * The list moves under the player: a sweep goes on delivering clips, and a
   * filter can carry off the one being watched. Following the id rather than the
   * index is what keeps the screen honest — here it has nothing left to show.
   */
  it('closes when the clip leaves the list', () => {
    const { onPlayingIdChange } = setup({ clips: [clip('a'), clip('c')] })

    expect(onPlayingIdChange).toHaveBeenCalledWith(null)
  })
})

describe('ClipPlayer, moving through the clips', () => {
  it('says where it is in the list', () => {
    setup()

    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('goes to the next clip and to the previous one', () => {
    const { onPlayingIdChange } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Clip suivant' }))
    expect(onPlayingIdChange).toHaveBeenCalledWith('c')

    fireEvent.click(screen.getByRole('button', { name: 'Clip précédent' }))
    expect(onPlayingIdChange).toHaveBeenCalledWith('a')
  })

  it('stops at both ends of the list', () => {
    setup({ playingId: 'a' })
    expect(screen.getByRole('button', { name: 'Clip précédent' })).toBeDisabled()

    cleanup()
    setup({ playingId: 'c' })
    expect(screen.getByRole('button', { name: 'Clip suivant' })).toBeDisabled()
  })

  // The arrows serve the eye still on our chrome; once the focus enters the
  // player, Twitch gets them and we never see them.
  it('follows the arrow keys', () => {
    const { onPlayingIdChange } = setup()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })

    expect(onPlayingIdChange).toHaveBeenCalledWith('c')
  })
})

describe('ClipPlayer, selection', () => {
  it('checks the clip being watched', () => {
    const { onToggle } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))

    expect(onToggle).toHaveBeenCalledWith('b')
  })

  it('offers to drop a clip already checked', () => {
    const { onToggle } = setup({ selected: new Set(['b']) })

    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }))

    expect(onToggle).toHaveBeenCalledWith('b')
  })
})
