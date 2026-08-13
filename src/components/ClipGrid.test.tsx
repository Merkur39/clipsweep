// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SORT, type ClipSort } from '../domain/sort'
import type { Clip } from '../twitch/types'
import { ClipGrid } from './ClipGrid'

afterEach(cleanup)

const clip = (id: string, over: Partial<Clip> = {}): Clip =>
  ({
    id,
    url: `https://www.twitch.tv/testchannel/clip/${id}`,
    embed_url: '',
    broadcaster_name: 'TestChannel',
    creator_name: 'SpiZ',
    title: `Titre ${id}`,
    view_count: 12,
    created_at: '2026-01-15T00:00:00Z',
    thumbnail_url: `https://clips-media-assets2.twitch.tv/${id}-preview-480x272.jpg`,
    duration: 30,
    game_id: '1',
    ...over,
  }) as Clip

const setup = (
  options: { clips?: Clip[]; selected?: ReadonlySet<string>; sort?: ClipSort } = {},
) => {
  const onToggle = vi.fn()
  const onPlay = vi.fn()
  const onSortChange = vi.fn()
  render(
    <ClipGrid
      clips={options.clips ?? [clip('a'), clip('b')]}
      selected={options.selected ?? new Set()}
      onToggle={onToggle}
      onPlay={onPlay}
      emptyMessage="rien"
      sort={options.sort ?? DEFAULT_SORT}
      onSortChange={onSortChange}
    />,
  )
  return { onToggle, onPlay, onSortChange }
}

const tile = (id: string) => screen.getByRole('button', { name: `Lire Titre ${id}` })

describe('ClipGrid, the tiles', () => {
  it('lays out one tile per clip', () => {
    setup()

    expect(tile('a')).toBeInTheDocument()
    expect(tile('b')).toBeInTheDocument()
  })

  it('carries the thumbnail, deferred until it is needed', () => {
    setup({ clips: [clip('a')] })
    const image = document.querySelector('.tile-thumb') as HTMLImageElement

    expect(image.src).toContain('a-preview-480x272.jpg')
    // The attribute, not the property: jsdom does not implement `loading`.
    expect(image.getAttribute('loading')).toBe('lazy')
  })

  // The tool exists to unearth the clips nobody sees: their length is what says
  // whether they are worth a look.
  it('reads the clip length on its badge', () => {
    setup({ clips: [clip('a', { duration: 65 })] })

    expect(screen.getByText('1:05')).toBeInTheDocument()
  })

  // A thumbnail can be missing or expired, and a broken image icon in the
  // middle of the board says nothing about the clip behind it.
  it('stands in for a thumbnail it cannot show', () => {
    setup({ clips: [clip('a', { thumbnail_url: '' })] })

    expect(document.querySelector('.tile-thumb-missing')).toBeInTheDocument()
  })
})

describe('ClipGrid, watching and choosing', () => {
  it('plays the clip whose tile is clicked', () => {
    const { onPlay } = setup()

    fireEvent.click(tile('b'))

    expect(onPlay).toHaveBeenCalledWith('b')
  })

  /**
   * The two gestures share a tile and must not be confused: the box is the only
   * thing that chooses, everything else watches. Nesting them would be invalid
   * markup as much as an ambiguous target.
   */
  it('checks the clip whose box is ticked, without playing it', () => {
    const { onToggle, onPlay } = setup()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Titre a' }))

    expect(onToggle).toHaveBeenCalledWith('a')
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('marks the tiles that are kept', () => {
    setup({ selected: new Set(['a']) })

    expect(screen.getByRole('checkbox', { name: 'Titre a' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Titre b' })).not.toBeChecked()
    expect(document.querySelectorAll('.tile.is-picked')).toHaveLength(1)
  })
})

describe('ClipGrid, ordering', () => {
  it('offers the same four keys as the table', () => {
    setup()

    for (const name of ['Vues', 'Date', 'Titre', 'Créateur']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('requests the order asked for', () => {
    const { onSortChange } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Date' }))

    expect(onSortChange).toHaveBeenCalledWith('date')
  })

  // No column to carry `aria-sort` here: the pressed state is what says which
  // key is in force.
  it('announces the key in force', () => {
    setup({ sort: { key: 'views', direction: 'asc' } })

    expect(screen.getByRole('button', { name: 'Vues' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Date' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('ClipGrid, with nothing to show', () => {
  it('says why, and offers the way out', () => {
    const onClick = vi.fn()
    render(
      <ClipGrid
        clips={[]}
        selected={new Set()}
        onToggle={vi.fn()}
        onPlay={vi.fn()}
        emptyMessage="Aucun clip sur cette période."
        emptyAction={{ label: 'Voir les 300', onClick }}
        sort={DEFAULT_SORT}
        onSortChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Aucun clip sur cette période.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voir les 300' }))
    expect(onClick).toHaveBeenCalled()
  })
})
