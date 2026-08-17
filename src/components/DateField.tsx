import { useTranslation } from '../i18n/LocaleProvider'
import { Icon } from './Icon'

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
 * selecting each segment in turn.
 *
 * It shares `.numfield` with the threshold rather than getting a class of its
 * own: what that class names is a field carrying an inline clear, and this is
 * one. Only the room made on the right differs, the native picker indicator
 * already sitting there — the sheet settles that.
 *
 * The bounds grey out the impossible in the picker, nothing more: they call no
 * `clamp`, unlike the sweep's own. A date typed outside the extent spends no
 * request — it empties the table, a case the empty-table message names.
 */
export function DateField({ label, value, onChange, min, max }: DateFieldProps) {
  const { t } = useTranslation()
  const clear = t('filters.clearField', { label })

  return (
    <label className="fieldset">
      <span className="flabel">{label}</span>
      <span className="numfield">
        <input
          className="date"
          type="date"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value !== '' && (
          <button
            type="button"
            className="clear"
            onClick={() => onChange('')}
            aria-label={clear}
            title={clear}
          >
            <Icon name="x" />
          </button>
        )}
      </span>
    </label>
  )
}
