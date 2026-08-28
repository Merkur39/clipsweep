import type { DateExtent, Facet } from '../domain/filters'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTranslation } from '../i18n/LocaleProvider'
import { DateField } from './DateField'
import { FilterChip } from './FilterChip'
import { describeDayRange, describeViewRange } from './filterLabel'
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
 * Four chips, where six labelled fields used to stand in a permanent row above
 * the readout. The row cost a band of height at all times for controls that are
 * empty most of the time; a chip reads at rest exactly what its filter is worth
 * and asks for room only while it is being set. The two that go together — the
 * pair of thresholds, the pair of bounds — share one chip, since neither half
 * means much without the other.
 *
 * The blanket reset does not live here: every chip already carries its own —
 * a cross for a field, "Uncheck all" for a facet — and the global button stole
 * a place from a row that has none to spare. It lives on the ticket, above.
 *
 * On a phone the four fold into one, and that is a thing a sheet cannot do: four
 * chips wrap onto two rows where the toolbar is already carrying a sort, a
 * search and a density. The folded chip says how many of the four are set, which
 * is what a row of four said by being lit.
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
  const { locale, t } = useTranslation()
  const compact = useMediaQuery('(max-width: 700px)')

  /** How many of the four bite, which is what a row of four says by being lit. */
  const active =
    Number(Boolean(minViews || maxViews)) +
    Number(Boolean(from || to)) +
    Number(creators.length > 0) +
    Number(gameIds.length > 0)

  const chips = (
    <>
      <FilterChip label={t('filters.views')} value={describeViewRange(minViews, maxViews, locale)}>
        <div className="filter-fields">
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
        </div>
      </FilterChip>

      <FilterChip label={t('filters.dates')} value={describeDayRange({ from, to }, locale)}>
        <div className="filter-fields">
          {/* The bounds come from the collected clips, not from the period
              searched: a search started before the channel's creation would
              otherwise offer dates none of which can return anything. */}
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
        </div>
      </FilterChip>

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
    </>
  )

  /* Named, because the chips are the only controls of the page that stand loose
     on the ground: the ticket and the two readouts each carry their own frame,
     this row has none, and an unnamed group of buttons says nothing about what
     they have in common. */
  return (
    <div className="filters" role="group" aria-label={t('filters.label')}>
      {compact ? (
        <FilterChip
          label={t('filters.compact')}
          value={active > 0 ? <span className="chip-count">{active}</span> : null}
        >
          <div className="filters-stack">{chips}</div>
        </FilterChip>
      ) : (
        chips
      )}
    </div>
  )
}
