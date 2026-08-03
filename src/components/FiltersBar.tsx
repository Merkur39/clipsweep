import type { DateExtent, Facet } from '../domain/filters'
import { useTranslation } from '../i18n/LocaleProvider'
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
  const { t } = useTranslation()

  return (
    <div className="filters">
      <NumberField
        label={t('filters.minViews')}
        placeholder={t('filters.noThreshold')}
        value={minViews}
        onChange={onMinViewsChange}
      />
      <NumberField
        label={t('filters.maxViews')}
        placeholder={t('filters.noThreshold')}
        value={maxViews}
        onChange={onMaxViewsChange}
      />
      {/* Les bornes viennent des clips récupérés, pas de la période scannée :
          un scan lancé avant la création de la chaîne offrirait sinon des
          dates dont aucune ne peut rien rendre. */}
      <DateField
        label={t('filters.from')}
        value={from}
        onChange={onFromChange}
        min={dateBounds?.first}
        max={dateBounds?.last}
      />
      <DateField
        label={t('filters.to')}
        value={to}
        onChange={onToChange}
        min={dateBounds?.first}
        max={dateBounds?.last}
      />
      <MultiSelect
        label={t('filters.creators')}
        options={creatorFacets}
        selected={creators}
        onChange={onCreatorsChange}
      />
      <MultiSelect
        label={t('filters.games')}
        options={gameFacets}
        selected={gameIds}
        onChange={onGameIdsChange}
        labelOf={gameLabel}
      />
    </div>
  )
}
