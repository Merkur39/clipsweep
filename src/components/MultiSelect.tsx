import { useEffect, useId, useRef, useState } from 'react'

import type { Facet } from '../domain/filters'
import { formatCount } from '../domain/numbers'
import { ChevronIcon } from './Icon'
import { describeSelection } from './selectionLabel'

export interface MultiSelectProps {
  label: string
  options: Facet[]
  selected: readonly string[]
  onChange: (next: string[]) => void
  /** Maps a stored value to what the user reads — game ids to game names. */
  labelOf?: (value: string) => string
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  labelOf = (value) => value,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const labelId = `${baseId}-label`
  const valueId = `${baseId}-value`

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
  }, [open])

  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((kept) => kept !== value) : [...selected, value],
    )

  return (
    <div className="multiselect" ref={rootRef}>
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <button
        type="button"
        className="multiselect-button"
        onClick={() => setOpen((previous) => !previous)}
        disabled={options.length === 0}
        aria-expanded={open}
        aria-controls={panelId}
        // Sans ça le nom accessible se réduit à la valeur : « Ori », sans dire
        // de quelle facette il s'agit.
        aria-labelledby={`${labelId} ${valueId}`}
      >
        <span className="multiselect-value" id={valueId}>
          {describeSelection(selected, labelOf)}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="multiselect-panel" id={panelId} role="group" aria-label={label}>
          {selected.length > 0 && (
            <button type="button" className="link" onClick={() => onChange([])}>
              Tout décocher
            </button>
          )}
          {options.map((option) => (
            <label key={option.value} className="multiselect-option">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span className="multiselect-option-name">{labelOf(option.value)}</span>
              <span className="multiselect-option-count">{formatCount(option.count)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
