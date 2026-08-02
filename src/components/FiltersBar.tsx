import type { DateExtent, Facet } from '../domain/filters'
import { DateField } from './DateField'
import { MultiSelect } from './MultiSelect'
import { NumberField } from './NumberField'

export interface FiltersBarProps {
  minViews: string
  onMinViewsChange: (next: string) => void
  maxViews: string
  onMaxViewsChange: (next: string) => void

  /** `yyyy-mm-dd`, or empty for no restriction. */
  from: string
  onFromChange: (next: string) => void
  to: string
  onToChange: (next: string) => void
  /** L'étendue des clips récupérés, ou null tant qu'il n'y en a aucun. */
  dateBounds: DateExtent | null

  creatorFacets: Facet[]
  creators: readonly string[]
  onCreatorsChange: (next: string[]) => void

  gameFacets: Facet[]
  gameIds: readonly string[]
  onGameIdsChange: (next: string[]) => void
  gameLabel: (id: string) => string
}

/**
 * Display filters. They never touch the search, only what it already returned.
 *
 * La remise à zéro d'ensemble n'est pas ici : chaque contrôle porte déjà la
 * sienne — croix pour un champ, « Tout décocher » pour une facette — et le
 * bouton global volait une colonne à une rangée qui n'en a pas de trop. Il vit
 * au bout de l'étiquette « Résultats », au-dessus.
 */
export function FiltersBar({
  minViews,
  onMinViewsChange,
  maxViews,
  onMaxViewsChange,
  from,
  onFromChange,
  to,
  onToChange,
  dateBounds,
  creatorFacets,
  creators,
  onCreatorsChange,
  gameFacets,
  gameIds,
  onGameIdsChange,
  gameLabel,
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
      {/* Les bornes viennent des clips récupérés, pas de la période fouillée :
          une fouille lancée avant la création de la chaîne offrirait sinon des
          dates dont aucune ne peut rien rendre. */}
      <DateField
        label="Du"
        value={from}
        onChange={onFromChange}
        min={dateBounds?.first}
        max={dateBounds?.last}
      />
      <DateField
        label="Au"
        value={to}
        onChange={onToChange}
        min={dateBounds?.first}
        max={dateBounds?.last}
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
    </div>
  )
}
