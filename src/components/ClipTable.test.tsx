// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SORT, type ClipSort } from '../domain/sort'
import type { Clip } from '../twitch/types'
import { ClipTable } from './ClipTable'

afterEach(cleanup)

const clip = (id: string, viewCount = 1): Clip =>
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
  }) as Clip

const setup = (
  options: { clips?: Clip[]; sort?: ClipSort; selected?: ReadonlySet<string> } = {},
) => {
  const onSortChange = vi.fn()
  const onToggle = vi.fn()
  const view = render(
    <ClipTable
      clips={options.clips ?? [clip('a'), clip('b')]}
      selected={options.selected ?? new Set()}
      onToggle={onToggle}
      onToggleAll={vi.fn()}
      emptyMessage="rien"
      sort={options.sort ?? DEFAULT_SORT}
      onSortChange={onSortChange}
    />,
  )
  return { onSortChange, onToggle, view }
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

  // Le titre est un lien vers le clip : le clic doit l'ouvrir, pas cocher.
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

describe('ClipTable, tri', () => {
  it('renders every sortable column as a button', () => {
    setup()

    for (const nom of ['Vues', 'Date', 'Titre', 'Créateur']) {
      expect(header(nom)).toBeInTheDocument()
    }
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

  // Staying at pixel 170,000 in front of entirely different clips helps nobody:
  // a new order has just been asked for, and its beginning is what we want.
  it('returns to the top when the sort changes', () => {
    const clips = Array.from({ length: 500 }, (_, index) => clip(`c${index}`, index))
    const { view } = setup({ clips, sort: { key: 'views', direction: 'asc' } })

    const scroller = document.querySelector('.table-body')!
    scroller.scrollTop = 4000

    view.rerender(
      <ClipTable
        clips={clips}
        selected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        emptyMessage="rien"
        sort={{ key: 'views', direction: 'desc' }}
        onSortChange={vi.fn()}
      />,
    )

    expect(scroller.scrollTop).toBe(0)
  })

  it('leaves the scroll alone when only the content changes', () => {
    const clips = Array.from({ length: 500 }, (_, index) => clip(`c${index}`, index))
    const sort: ClipSort = { key: 'views', direction: 'asc' }
    const { view } = setup({ clips, sort })

    const scroller = document.querySelector('.table-body')!
    scroller.scrollTop = 4000

    view.rerender(
      <ClipTable
        clips={clips.slice(0, 400)}
        selected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        emptyMessage="rien"
        sort={sort}
        onSortChange={vi.fn()}
      />,
    )

    expect(scroller.scrollTop).toBe(4000)
  })
})
