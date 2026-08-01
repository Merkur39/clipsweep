// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SORT, type ClipSort } from '../domain/sort'
import type { Clip } from '../twitch/types'
import { ClipTable } from './ClipTable'

afterEach(cleanup)

const clip = (id: string, viewCount = 1): Clip =>
  ({
    id,
    url: `https://www.twitch.tv/kaliyami/clip/${id}`,
    embed_url: '',
    broadcaster_name: 'KaliYami',
    creator_name: 'SpiZ',
    title: `Titre ${id}`,
    view_count: viewCount,
    created_at: '2026-01-15T00:00:00Z',
    thumbnail_url: '',
    duration: 30,
    game_id: '1',
  }) as Clip

const setup = (options: { clips?: Clip[]; sort?: ClipSort } = {}) => {
  const onSortChange = vi.fn()
  const view = render(
    <ClipTable
      clips={options.clips ?? [clip('a'), clip('b')]}
      deselected={new Set()}
      onToggle={vi.fn()}
      onToggleAll={vi.fn()}
      emptyMessage="rien"
      sort={options.sort ?? DEFAULT_SORT}
      onSortChange={onSortChange}
    />,
  )
  return { onSortChange, view }
}

const header = (name: string) => screen.getByRole('button', { name })

describe('ClipTable, tri', () => {
  it('rend chaque colonne triable comme un bouton', () => {
    setup()

    for (const nom of ['Vues', 'Date', 'Titre', 'Créateur']) {
      expect(header(nom)).toBeInTheDocument()
    }
  })

  it('demande le tri de la colonne cliquée', () => {
    const { onSortChange } = setup()

    fireEvent.click(header('Titre'))

    expect(onSortChange).toHaveBeenCalledWith('title')
  })

  it('annonce la colonne triée et son sens', () => {
    setup({ sort: { key: 'views', direction: 'asc' } })

    expect(header('Vues').closest('[aria-sort]')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Date').closest('[aria-sort]')).toHaveAttribute('aria-sort', 'none')
  })

  it('reflète le sens décroissant', () => {
    setup({ sort: { key: 'date', direction: 'desc' } })

    expect(header('Date').closest('[aria-sort]')).toHaveAttribute('aria-sort', 'descending')
  })

  // Rester au pixel 170 000 devant des clips entièrement différents n'aide
  // personne : on vient de demander un nouvel ordre, on veut en voir le début.
  it('revient en haut quand le tri change', () => {
    const clips = Array.from({ length: 500 }, (_, index) => clip(`c${index}`, index))
    const { view } = setup({ clips, sort: { key: 'views', direction: 'asc' } })

    const scroller = document.querySelector('.table-body')!
    scroller.scrollTop = 4000

    view.rerender(
      <ClipTable
        clips={clips}
        deselected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        emptyMessage="rien"
        sort={{ key: 'views', direction: 'desc' }}
        onSortChange={vi.fn()}
      />,
    )

    expect(scroller.scrollTop).toBe(0)
  })

  it('ne touche pas au défilement quand seul le contenu change', () => {
    const clips = Array.from({ length: 500 }, (_, index) => clip(`c${index}`, index))
    const sort: ClipSort = { key: 'views', direction: 'asc' }
    const { view } = setup({ clips, sort })

    const scroller = document.querySelector('.table-body')!
    scroller.scrollTop = 4000

    view.rerender(
      <ClipTable
        clips={clips.slice(0, 400)}
        deselected={new Set()}
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
