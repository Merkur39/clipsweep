// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import type { TileView } from '../domain/view'
import type { Clip } from '../twitch/types'
import { ClipGrid } from './ClipGrid'

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

type Options = {
  clips?: Clip[]
  selected?: ReadonlySet<string>
  view?: TileView
}

const setup = (options: Options = {}) => {
  const onToggle = vi.fn()
  const onPlay = vi.fn()
  const onHover = vi.fn()
  const rendered = render(
    <ClipGrid
      view={options.view ?? 'grid'}
      clips={options.clips ?? [clip('a'), clip('b')]}
      selected={options.selected ?? new Set()}
      onToggle={onToggle}
      onPlay={onPlay}
      onHover={onHover}
      emptyMessage="rien"
    />,
  )
  const at = (view: TileView) =>
    rendered.rerender(
      <ClipGrid
        view={view}
        clips={options.clips ?? [clip('a'), clip('b')]}
        selected={options.selected ?? new Set()}
        onToggle={onToggle}
        onPlay={onPlay}
        onHover={vi.fn()}
        emptyMessage="rien"
      />,
    )
  return { onToggle, onPlay, onHover, at }
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

  /* The box and nothing else: the tile has no frame left to mark, so what says
     a clip is kept is the one control that is drawn on every tile whether it is
     kept or not. */
  it('marks the tiles that are kept', () => {
    setup({ selected: new Set(['a']) })

    expect(screen.getByRole('checkbox', { name: 'Titre a' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Titre b' })).not.toBeChecked()
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
        onHover={vi.fn()}
        emptyMessage="Aucun clip sur cette période."
        emptyAction={{ label: 'Voir les 300', onClick }}
        view="grid"
      />,
    )

    expect(screen.getByText('Aucun clip sur cette période.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voir les 300' }))
    expect(onClick).toHaveBeenCalled()
  })
})

/**
 * Two densities out of one component: the sheet draws the block under the
 * thumbnail, this places the rows, and the two answer to `TILE_GEOMETRY`. That
 * the figures agree is checked by `scripts/geometry/tile.test.ts`; what is
 * checked here is that the density actually reaches the sheet and the layout.
 */
describe('ClipGrid, the two densities', () => {
  const rows = () => document.querySelector('.grid-rows') as HTMLElement
  const many = Array.from({ length: 60 }, (_, index) => clip(String(index).padStart(2, '0')))

  /** What the page holds above the board — a ticket, a toolbar, a drawer. */
  const HEADER = 200

  /**
   * The board scrolls with the page now, so a scroll is a rect and a
   * `window.scrollY` that agree: the rows begin `HEADER` into the document, and
   * the reader has run `within` pixels into them.
   */
  const scrollTo = (within: number) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: -within,
      left: 0,
      right: 0,
      bottom: 0,
      width: 900,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
    Object.defineProperty(window, 'scrollY', { value: HEADER + within, configurable: true })
    fireEvent.scroll(window)
  }

  it('tells the sheet which density it is drawn at', () => {
    setup({ view: 'large' })

    expect(document.querySelector('.grid')).toHaveAttribute('data-density', 'large')
  })

  // Applied from the geometry rather than written in the sheet: the virtualiser
  // multiplies these very gaps to place its rows, and a second copy of them is
  // one more thing that can drift. Rows apart, then columns apart: a row of
  // images needs more air under it than beside it.
  it('lays the rows out at the columns and the gaps of its density', () => {
    const { at } = setup({ clips: many, view: 'grid' })
    // 900px of stage: three columns of 230, two of 400.
    expect(rows().style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
    expect(rows().style.gap).toBe('18px 14px')

    at('large')

    expect(rows().style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    expect(rows().style.gap).toBe('24px 20px')
  })

  /**
   * The clips are in the same order at either density, only drawn at another
   * size: the reader keeps their place. Rows of 227 against rows of 348 —
   * leaving the offset alone would drop them from clip 12 to clip 4.
   */
  it('brings the row holding the clip at the top of the view to the top', () => {
    const scroll = vi.spyOn(window, 'scrollTo')
    const { at } = setup({ clips: many, view: 'grid' })
    // Row 4 of 227px: three columns, hence clip 12 at the top edge.
    scrollTo(4 * 227)

    at('large')

    // Two columns: the same clip 12 opens row 6, counted from where the board
    // begins in the document.
    expect(scroll).toHaveBeenCalledWith(0, HEADER + 6 * 348)
  })

  /* Nothing to bring back: the beginning of the board is on screen, and
     scrolling to it would push the ticket off the top of the page. */
  it('leaves a reader who can see the first row where they are', () => {
    const scroll = vi.spyOn(window, 'scrollTo')
    const { at } = setup({ clips: many, view: 'grid' })
    scrollTo(0)

    at('large')

    expect(scroll).not.toHaveBeenCalled()
  })
})

/**
 * What the keyboard acts on: space plays the clip under the pointer, X picks it.
 * The tile reports the pointer, and nothing else — the sheet already draws the
 * hover, so the caller can keep this in a ref and spend no render on it.
 */
describe('ClipGrid, what the pointer is over', () => {
  it('reports the tile entered', () => {
    const { onHover } = setup()

    fireEvent.mouseEnter(document.querySelectorAll('.tile')[0])

    expect(onHover).toHaveBeenCalledWith('a')
  })

  // Leaving one tile for the next is an enter; only leaving the board clears it.
  it('clears it on the way out of the board', () => {
    const { onHover } = setup()

    fireEvent.mouseLeave(document.querySelector('.tile')!.parentElement!.parentElement!)

    expect(onHover).toHaveBeenCalledWith(null)
  })
})
