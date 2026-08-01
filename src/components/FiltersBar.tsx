import type { Facet } from '../domain/filters'
import { MultiSelect } from './MultiSelect'
import { NumberField } from './NumberField'

export interface FiltersBarProps {
  minViews: string
  onMinViewsChange: (next: string) => void
  maxViews: string
  onMaxViewsChange: (next: string) => void

  creatorFacets: Facet[]
  creators: readonly string[]
  onCreatorsChange: (next: string[]) => void

  gameFacets: Facet[]
  gameIds: readonly string[]
  onGameIdsChange: (next: string[]) => void
  gameLabel: (id: string) => string

  active: boolean
  onReset: () => void
}

/** Display filters. They never touch the search, only what it already returned. */
export function FiltersBar({
  minViews,
  onMinViewsChange,
  maxViews,
  onMaxViewsChange,
  creatorFacets,
  creators,
  onCreatorsChange,
  gameFacets,
  gameIds,
  onGameIdsChange,
  gameLabel,
  active,
  onReset,
}: FiltersBarProps) {
  return (
    <div className="filters">
      <NumberField
        label="Vues min"
        placeholder="aucune"
        value={minViews}
        onChange={onMinViewsChange}
      />
      <NumberField
        label="Vues max"
        placeholder="aucune"
        value={maxViews}
        onChange={onMaxViewsChange}
      />
      <MultiSelect
        label="Créateurs"
        options={creatorFacets}
        selected={creators}
        onChange={onCreatorsChange}
      />
      <MultiSelect
        label="Jeux"
        options={gameFacets}
        selected={gameIds}
        onChange={onGameIdsChange}
        labelOf={gameLabel}
      />
      {/* Toujours rendu, sinon son apparition décale toute la rangée. */}
      <button type="button" className="link filters-reset" onClick={onReset} disabled={!active}>
        Réinitialiser
      </button>
    </div>
  )
}
