import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import type { DateExtent, Facet } from '../domain/filters'
import { formatCount } from '../i18n/format'
import type { Locale } from '../i18n/locales'
import { useTranslation } from '../i18n/LocaleProvider'
import { DateField } from './DateField'
import { Icon, type IconName } from './Icon'
import { MultiSelect } from './MultiSelect'
import { NumberField } from './NumberField'
import { describeSelection } from './selectionLabel'

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

  /** At least one filter restricts something: the blanket reset has work. */
  filtersActive: boolean
  onReset: () => void
}

/**
 * The two open ends of the views range, in the very notation `filters.anyViews`
 * writes — an en dash between a floor and a ceiling. Composed here rather than
 * translated: only one of the two ends is usually open, and a key per
 * combination would be three keys saying the same arithmetic. The catalogues
 * carry the same characters in both languages, a number range being no prose.
 */
const NO_FLOOR = '0'
const NO_CEILING = '∞'
const VIEWS_SPAN = ' – '

/** Creators are stored under the name they are read by; there is nothing to map. */
const asIs = (value: string) => value

/** One end of the views range: the figure typed, or the end left open. */
function viewsBound(raw: string, open: string, locale: Locale): string {
  const value = Number(raw)
  return raw === '' || !Number.isFinite(value) ? open : formatCount(value, locale)
}

/**
 * The dismissal every filter panel obeys: a pointer landing outside the pill's
 * own subtree closes it, and so does Escape.
 *
 * `pointerdown` rather than `click` — the press is where the intent is
 * expressed, and a drag begun outside but released over the panel would
 * otherwise leave it standing.
 *
 * The listeners are hung only while the panel is open: a closed filter has
 * nothing to dismiss, and four of them subscribed at all times would run on
 * every pointer event of the page.
 */
function useDismiss(open: boolean, setOpen: (next: boolean) => void) {
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  return rootRef
}

interface FilterPillProps {
  /** Fixed per facet: an eye for views, a calendar for the range, and so on. */
  glyph: IconName
  label: string
  /** What the facet lets through — read off the pill, without opening it. */
  value: string
  /** The facet restricts something; the pill is drawn in the accent. */
  active: boolean
  /** Nothing to offer yet: the pill stays, dimmed, rather than disappearing. */
  unavailable?: boolean
  /** Minted by the caller, which hands the same one to the panel it opens. */
  panelId: string
  children: ReactNode
}

/**
 * A filter, closed. It carries the facet's name and its current value, so the
 * whole row can be read without opening anything — which is precisely what
 * makes a panel affordable: it is never the only way to know.
 *
 * The panel is mounted on opening and thrown away on closing. Every piece of
 * state it holds — a scroll position, a measured height — is therefore born
 * with it, and no reopening inherits where the last one was left.
 */
function FilterPill({
  glyph,
  label,
  value,
  active,
  unavailable = false,
  panelId,
  children,
}: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useDismiss(open, setOpen)

  return (
    <span className="anchored" ref={rootRef}>
      <button
        type="button"
        className="fpill sm"
        aria-pressed={active ? 'true' : 'false'}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={panelId}
        // `aria-disabled` and not `disabled`: the pill keeps its place in the
        // tab order and still announces its facet and its value. Only the
        // opening is barred — a panel already open must stay closable, and the
        // facet it lists can empty out under it.
        aria-disabled={unavailable ? 'true' : undefined}
        onClick={() => setOpen((was) => (was ? false : !unavailable))}
      >
        <Icon name={glyph} />
        <em>{label}</em>
        <b>{value}</b>
      </button>
      {open && children}
    </span>
  )
}

/**
 * The shell `MultiSelect` draws for itself, for the two panels that hold fields
 * instead of a windowed list. The list brings its own inset because it scrolls
 * under the panel's edge; a pair of fields must not touch it.
 */
function FieldsPanel({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="popover" id={id} role="group" aria-label={label}>
      <div className="popover-body">{children}</div>
    </div>
  )
}

/**
 * Display filters. They never touch the search, only what it already returned.
 *
 * Six filters, three natures, four pills: the two view thresholds share one,
 * the two date bounds share another, and each facet keeps its own. Pairing them
 * is not a saving of room — a floor without its ceiling is half a statement,
 * and the pill reads the pair as the one range it is.
 *
 * The blanket reset comes back into the row, at its end. It used to sit at the
 * end of the "Results" label for want of a column here; a row of four pills has
 * the column, and the reset belongs beside what it resets.
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
  filtersActive,
  onReset,
}: FiltersBarProps) {
  const { locale, t } = useTranslation()

  // Minted here rather than inside the pill: the pill's `aria-controls` and the
  // panel's `id` are two halves of one link, and the two elements are written
  // side by side below.
  const viewsPanel = useId()
  const rangePanel = useId()
  const creatorsPanel = useId()
  const gamesPanel = useId()

  const viewsActive = minViews !== '' || maxViews !== ''
  const viewsValue = viewsActive
    ? viewsBound(minViews, NO_FLOOR, locale) + VIEWS_SPAN + viewsBound(maxViews, NO_CEILING, locale)
    : t('filters.anyViews')

  // A single bound is not half a range, it is an open one, and `rangeValue`
  // has no form for that — it would leave a marker showing. The two segments
  // the empty-table message already uses say it in words instead, and no pill
  // claims a bound the panel would show empty.
  const rangeValue =
    from !== '' && to !== ''
      ? t('filters.rangeValue', { from: { day: from }, to: { day: to } })
      : from !== ''
        ? t('results.range.from', { from: { day: from } })
        : to !== ''
          ? t('results.range.to', { to: { day: to } })
          : t('filters.anyRange')

  return (
    // `.scroll-filters` and the pills' `.sm` ride at every width and mean
    // nothing above 768px: the sheet declares them inside the breakpoint, which
    // spares the components a media query they would have to hold in JavaScript
    // and keep in step with the one in CSS.
    <div className="filters glass scroll-filters">
      <FilterPill
        glyph="eye"
        label={t('filters.views')}
        value={viewsValue}
        active={viewsActive}
        panelId={viewsPanel}
      >
        <FieldsPanel id={viewsPanel} label={t('filters.views')}>
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
        </FieldsPanel>
      </FilterPill>

      <FilterPill
        glyph="cal"
        label={t('filters.range')}
        value={rangeValue}
        active={from !== '' || to !== ''}
        panelId={rangePanel}
      >
        <FieldsPanel id={rangePanel} label={t('filters.range')}>
          {/* The bounds come from the collected clips, not from the period
              swept: a sweep started before the channel's creation would
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
        </FieldsPanel>
      </FilterPill>

      {/* A facet with nothing to offer reads as a dash rather than as "All":
          "All" would promise a list, and there is none to open. */}
      <FilterPill
        glyph="users"
        label={t('filters.creators')}
        value={
          creatorFacets.length === 0 ? t('panel.nothingYet') : describeSelection(creators, asIs, t)
        }
        active={creators.length > 0}
        unavailable={creatorFacets.length === 0}
        panelId={creatorsPanel}
      >
        <MultiSelect
          id={creatorsPanel}
          label={t('filters.creators')}
          options={creatorFacets}
          selected={creators}
          onChange={onCreatorsChange}
        />
      </FilterPill>

      <FilterPill
        glyph="gamepad"
        label={t('filters.games')}
        value={
          gameFacets.length === 0 ? t('panel.nothingYet') : describeSelection(gameIds, gameLabel, t)
        }
        active={gameIds.length > 0}
        unavailable={gameFacets.length === 0}
        panelId={gamesPanel}
      >
        <MultiSelect
          id={gamesPanel}
          label={t('filters.games')}
          options={gameFacets}
          selected={gameIds}
          onChange={onGameIdsChange}
          labelOf={gameLabel}
        />
      </FilterPill>

      {/* Always drawn, dimmed when there is nothing to undo: its appearing and
          vanishing would shift the end of the row on every first filter. */}
      <button
        type="button"
        className="quiet"
        aria-disabled={filtersActive ? undefined : 'true'}
        onClick={() => {
          if (filtersActive) onReset()
        }}
      >
        {t('results.reset')}
      </button>
    </div>
  )
}
