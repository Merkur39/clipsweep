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
  /** The extent of the collected clips, or null while there are none. */
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
 * The blanket reset does not live here: every control already carries its own —
 * a cross for a field, "Uncheck all" for a facet — and the global button stole a
 * column from a row that has none to spare. It lives at the end of the "Results"
 * label, above.
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
      {/* The bounds come from the collected clips, not from the period swept: a
          sweep started before the channel's creation would otherwise offer
          dates none of which can return anything. */}
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
