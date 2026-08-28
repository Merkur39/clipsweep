// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SORT, type ClipSort } from '../domain/sort'
import type { Clip } from '../twitch/types'
import { ClipTable, type ClipTableProps } from './ClipTable'

const clip = (id: string, viewCount = 1, over: Partial<Clip> = {}): Clip =>
  ({
    id,
    url: `https://www.twitch.tv/testchannel/clip/${id}`,
    embed_url: '',
    broadcaster_name: 'TestChannel',
    creator_name: 'SpiZ',
    title: `Titre ${id}`,
    view_count: viewCount,
    created_at: '2026-01-15T00:00:00Z',
    thumbnail_url: '',
    duration: 30,
    game_id: '1',
    ...over,
  }) as Clip

const setup = (
  options: {
    clips?: Clip[]
    sort?: ClipSort
    selected?: ReadonlySet<string>
    gameLabel?: (id: string) => string
  } = {},
) => {
  const onSortChange = vi.fn()
  const onToggle = vi.fn()
  const onPlay = vi.fn()
  const onHover = vi.fn()
  const view = render(
    <ClipTable
      clips={options.clips ?? [clip('a'), clip('b')]}
      selected={options.selected ?? new Set()}
      onToggle={onToggle}
      onToggleAll={vi.fn()}
      onPlay={onPlay}
      onHover={onHover}
      emptyMessage="rien"
      sort={options.sort ?? DEFAULT_SORT}
      onSortChange={onSortChange}
      gameLabel={options.gameLabel ?? ((id) => id)}
    />,
  )
  return { onSortChange, onToggle, onPlay, onHover, view }
}

const header = (name: string) => screen.getByRole('button', { name })

describe('ClipTable, row selection', () => {
  const row = (title: string) => screen.getByTitle(title).closest('.table-row')!

  // Nothing is checked by default: the box reads the selection, it does not
  // read its complement.
  it('checks the selected clips only', () => {
    setup({ selected: new Set(['a']) })

    expect(screen.getByRole('checkbox', { name: 'Titre a' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Titre b' })).not.toBeChecked()
  })

  it('checks the clicked row', () => {
    const { onToggle } = setup()

    fireEvent.click(row('Titre a'))

    expect(onToggle).toHaveBeenCalledWith('a')
  })

  // The title is a link to the clip: the click must open it, not tick the row.
  it('lets the title link open the clip', () => {
    const { onToggle } = setup()

    fireEvent.click(screen.getByTitle('Titre a'))

    expect(onToggle).not.toHaveBeenCalled()
  })

  // The checkbox already fires its own onChange: without a guard, the click
  // would bubble to the row and immediately undo the toggle.
  it('toggles only once when the checkbox itself is clicked', () => {
    const { onToggle } = setup()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Titre a' }))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

describe('ClipTable, playing a clip', () => {
  it('plays the clip of the row asked for', () => {
    const { onPlay } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Lire Titre b' }))

    expect(onPlay).toHaveBeenCalledWith('b')
  })

  // A third target excluded from the row click: watching a clip is not choosing
  // it, and the click must not do both at once.
  it('does not check the row it plays', () => {
    const { onToggle } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Lire Titre a' }))

    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe('ClipTable, tri', () => {
  it('renders every sortable column as a button', () => {
    setup()

    for (const nom of ['Vues', 'Date', 'Titre', 'Créateur', 'Durée']) {
      expect(header(nom)).toBeInTheDocument()
    }
  })

  // The game heads a column and no order: its chip groups better than an order
  // could, and a head that looks like the others but does nothing is worse than
  // a plain label.
  it('leaves the game column unheaded, and reading', () => {
    setup()

    expect(screen.queryByRole('button', { name: 'Jeu' })).toBeNull()
    expect(screen.getByText('Jeu')).toBeInTheDocument()
  })

  it('requests sorting on the clip length', () => {
    const { onSortChange } = setup()

    fireEvent.click(header('Durée'))

    expect(onSortChange).toHaveBeenCalledWith('duration')
  })

  it('requests sorting on the clicked column', () => {
    const { onSortChange } = setup()

    fireEvent.click(header('Titre'))

    expect(onSortChange).toHaveBeenCalledWith('title')
  })

  it('announces the sorted column and its direction', () => {
    setup({ sort: { key: 'views', direction: 'asc' } })

    expect(header('Vues').closest('[aria-sort]')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Date').closest('[aria-sort]')).toHaveAttribute('aria-sort', 'none')
  })

  it('reflects the descending direction', () => {
    setup({ sort: { key: 'date', direction: 'desc' } })

    expect(header('Date').closest('[aria-sort]')).toHaveAttribute('aria-sort', 'descending')
  })

  /**
   * The list scrolls with the page now, and its head is stuck to the top of the
   * screen — so an order can be asked for from a thousand rows down. Staying at
   * that pixel leaves the reader in front of entirely different clips.
   */
  const clips = Array.from({ length: 500 }, (_, index) => clip(`c${index}`, index))

  /** The list begins `top` from the top edge of the screen; negative once past it. */
  const at = (top: number) =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top,
      left: 0,
      right: 0,
      bottom: 0,
      width: 1200,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

  const redraw = (view: ReturnType<typeof setup>['view'], over: Partial<ClipTableProps>) =>
    view.rerender(
      <ClipTable
        clips={clips}
        selected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPlay={vi.fn()}
        onHover={vi.fn()}
        emptyMessage="rien"
        sort={{ key: 'views', direction: 'asc' }}
        onSortChange={vi.fn()}
        gameLabel={(id) => id}
        {...over}
      />,
    )

  it('returns to the top when the sort changes', () => {
    const { view } = setup({ clips, sort: { key: 'views', direction: 'asc' } })
    const scroll = vi.spyOn(window, 'scrollTo')
    // 4000 into the document, of which 3800 into the list.
    at(-3800)
    Object.defineProperty(window, 'scrollY', { value: 4000, configurable: true })

    redraw(view, { sort: { key: 'views', direction: 'desc' } })

    expect(scroll).toHaveBeenCalledWith(0, 200)
  })

  /* With the head still in the flow of the page, the beginning is already in
     view: scrolling to it would push the ticket off the top instead. */
  it('leaves a reader who can see the head where they are', () => {
    const { view } = setup({ clips, sort: { key: 'views', direction: 'asc' } })
    const scroll = vi.spyOn(window, 'scrollTo')
    at(200)

    redraw(view, { sort: { key: 'views', direction: 'desc' } })

    expect(scroll).not.toHaveBeenCalled()
  })

  it('leaves the scroll alone when only the content changes', () => {
    const { view } = setup({ clips, sort: { key: 'views', direction: 'asc' } })
    const scroll = vi.spyOn(window, 'scrollTo')
    at(-3800)

    redraw(view, { clips: clips.slice(0, 400) })

    expect(scroll).not.toHaveBeenCalled()
  })
})

describe('ClipTable, the columns', () => {
  const head = () => document.querySelector('.table-head') as HTMLElement

  // The title first and widest: it is what a clip is recognised by, and every
  // other column is a fact about it.
  it('leads with the title, then the facts about it', () => {
    setup()

    const cells = head().querySelectorAll(
      '.col-title, .col-views, .col-author, .col-game, .col-date, .col-length',
    )
    expect([...cells].map((cell) => cell.textContent?.trim())).toEqual([
      'Titre',
      'Vues',
      'Créateur',
      'Jeu',
      'Date',
      'Durée',
    ])
  })

  // Helix serves an id; the reader is owed the name. The same resolver the
  // filter chip reads by, so the two cannot name a category differently.
  it('names the game rather than showing the id Helix serves', () => {
    setup({
      clips: [clip('a')],
      gameLabel: (id) => (id === '1' ? 'Cult of the Lamb' : id),
    })

    expect(screen.getByText('Cult of the Lamb')).toBeInTheDocument()
  })

  it('reads the clip length as the badge does', () => {
    setup({ clips: [clip('a', 1, { duration: 65 })] })

    expect(screen.getByText('1:05')).toBeInTheDocument()
  })
})

/**
 * What the keyboard acts on: space plays the clip under the pointer, X picks it.
 * The row reports the pointer, and nothing else — the sheet already draws the
 * hover, so the caller can keep this in a ref and spend no render on it.
 */
describe('ClipTable, what the pointer is over', () => {
  it('reports the row entered', () => {
    const { onHover } = setup()

    fireEvent.mouseEnter(screen.getAllByRole('row')[1])

    expect(onHover).toHaveBeenCalledWith('a')
  })

  // Leaving one row for the next is an enter; only leaving the list clears it.
  it('clears it on the way out of the list', () => {
    const { onHover } = setup()

    fireEvent.mouseLeave(screen.getAllByRole('row')[1].parentElement!.parentElement!)

    expect(onHover).toHaveBeenCalledWith(null)
  })
})
