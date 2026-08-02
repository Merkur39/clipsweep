// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FiltersBar } from './FiltersBar'

afterEach(cleanup)

const setup = (props: Partial<Parameters<typeof FiltersBar>[0]> = {}) => {
  const handlers = {
    onMinViewsChange: vi.fn(),
    onMaxViewsChange: vi.fn(),
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
    onCreatorsChange: vi.fn(),
    onGameIdsChange: vi.fn(),
  }
  render(
    <FiltersBar
      minViews=""
      maxViews=""
      from=""
      to=""
      dateBounds={{ first: '2019-03-04', last: '2021-12-25' }}
      creatorFacets={[]}
      creators={[]}
      gameFacets={[]}
      gameIds={[]}
      gameLabel={(id) => id}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement

describe('FiltersBar', () => {
  it('remonte la borne de début saisie', () => {
    const { onFromChange } = setup()

    fireEvent.change(field('Du'), { target: { value: '2020-01-01' } })

    expect(onFromChange).toHaveBeenCalledWith('2020-01-01')
  })

  it('remonte la borne de fin saisie', () => {
    const { onToChange } = setup()

    fireEvent.change(field('Au'), { target: { value: '2020-06-30' } })

    expect(onToChange).toHaveBeenCalledWith('2020-06-30')
  })

  // Une date hors du jeu récupéré ne peut rien rendre : le sélecteur la grise.
  it('borne les deux champs sur l’étendue des clips récupérés', () => {
    setup()

    expect(field('Du')).toHaveAttribute('min', '2019-03-04')
    expect(field('Du')).toHaveAttribute('max', '2021-12-25')
    expect(field('Au')).toHaveAttribute('min', '2019-03-04')
    expect(field('Au')).toHaveAttribute('max', '2021-12-25')
  })

  it('ne pose aucune borne tant qu’aucun clip n’est récupéré', () => {
    setup({ dateBounds: null })

    expect(field('Du')).not.toHaveAttribute('min')
    expect(field('Du')).not.toHaveAttribute('max')
  })

  it('n’offre d’effacement qu’une fois la date posée', () => {
    setup()

    expect(screen.queryByRole('button', { name: 'Effacer Du' })).toBeNull()
  })

  it('vide la date par son bouton d’effacement', () => {
    const { onFromChange } = setup({ from: '2020-01-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Effacer Du' }))

    expect(onFromChange).toHaveBeenCalledWith('')
  })

  // La remise à zéro d'ensemble a quitté la rangée : chaque contrôle porte la
  // sienne, et le bouton global vit au bout de l'étiquette « Résultats ».
  it('ne porte pas de remise à zéro d’ensemble', () => {
    setup({ from: '2020-01-01' })

    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).toBeNull()
  })
})
