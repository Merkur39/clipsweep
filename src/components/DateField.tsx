import { useTranslation } from '../i18n/LocaleProvider'
import { CloseIcon } from './Icon'

export interface DateFieldProps {
  label: string
  /** `yyyy-mm-dd`, or empty for no restriction. */
  value: string
  onChange: (next: string) => void
  /** `yyyy-mm-dd`, or undefined while the range is unknown. */
  min?: string
  max?: string
}

/**
 * The dated counterpart of [NumberField], down to the overlaid clear button — a
 * native date field offers none, and emptying it from the keyboard means
 * selecting each segment.
 *
 * The bounds grey out the impossible in the picker, nothing more: they call no
 * `clamp`, unlike the sweep's own. A date typed outside the extent spends no
 * request — it empties the table, a case the empty-table message names.
 */
export function DateField({ label, value, onChange, min, max }: DateFieldProps) {
  const { t } = useTranslation()
  const clear = t('filters.clearField', { label })

  return (
    <label className="field date">
      <span className="field-label">{label}</span>
      <span className="field-control date">
        <input
          type="date"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value !== '' && (
          <button
            type="button"
            className="field-clear"
            onClick={() => onChange('')}
            aria-label={clear}
            title={clear}
          >
            <CloseIcon />
          </button>
        )}
      </span>
    </label>
  )
}
