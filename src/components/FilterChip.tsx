import { useId, useState, type ReactNode } from 'react'

import { useDismissable } from '../hooks/useDismissable'
import { ChevronIcon } from './Icon'

export interface FilterChipProps {
  label: string
  /**
   * What the control holds, read on the chip after its label. Null when it
   * holds nothing — the chip is then a bare word.
   */
  value?: ReactNode
  /**
   * Whether the chip wears the accent. A filter that bites does; a sort does
   * not, although it always has a value — an order is always in force, and a
   * chip lit at all times says nothing at all.
   */
  active?: boolean
  /** Nothing to open: a facet the search turned up no value for. */
  disabled?: boolean
  /** Fired on every opening and every closing — the panel lives only while open. */
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

/**
 * A filter, worn as a chip: the word it acts on, the value it holds, and a panel
 * that opens under it.
 *
 * It replaces a labelled field standing permanently in a row. Six of those cost
 * a band of the readout's height for controls that are, most of the time, empty
 * — while a chip says at rest exactly what it is worth, and asks for room only
 * when it is being set.
 *
 * The border is what says "control" here, so it is drawn in `--rule-control`
 * rather than in either separating hairline: a chip has nothing else — no fill,
 * no shadow — to distinguish it from a label, and that border owes 3:1
 * (WCAG 1.4.11).
 */
export function FilterChip({
  label,
  value = null,
  active,
  disabled = false,
  onOpenChange,
  children,
}: FilterChipProps) {
  const lit = active ?? value !== null
  const [open, setOpen] = useState(false)
  const panelId = `${useId()}-panel`

  // Announced from the handlers rather than from an effect on `open`: an effect
  // would also fire on mount, and the windowed list listening here would reset a
  // scroller it has not been given yet.
  const change = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  const rootRef = useDismissable<HTMLDivElement>(open, () => change(false))

  return (
    <div className="filter-chip-root" ref={rootRef}>
      <button
        type="button"
        className={lit ? 'chip filter-chip is-on' : 'chip filter-chip'}
        onClick={() => change(!open)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {label}
        {/* The space is what keeps the accessible name from reading
            "CréateursOri": the two are separate nodes, and the name is their
            concatenation. Whitespace-only text is not rendered in a flex
            container, so it costs nothing on screen — the gap draws it. */}
        {value !== null && (
          <>
            {' '}
            <b>{value}</b>
          </>
        )}
        <ChevronIcon />
      </button>

      {open && (
        <div className="filter-panel" id={panelId} role="group" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  )
}
