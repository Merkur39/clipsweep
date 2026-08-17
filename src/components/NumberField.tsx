import { useTranslation } from '../i18n/LocaleProvider'
import { Icon } from './Icon'

export interface NumberFieldProps {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
}

/**
 * A view threshold, with an inline clear.
 *
 * The clear is overlaid inside the field rather than filed beside it: showing
 * and hiding it must move neither the field nor the one under it, which is
 * exactly what a conditionally rendered sibling in the flow would do — and the
 * two thresholds sit one above the other in a panel barely wider than they are.
 *
 * The `<label>` wraps the field rather than pointing at it: no id has to be
 * minted, and the whole block — silkscreen name included — becomes the target.
 */
export function NumberField({ label, value, onChange, placeholder }: NumberFieldProps) {
  const { t } = useTranslation()
  const clear = t('filters.clearField', { label })

  return (
    <label className="fieldset">
      <span className="flabel">{label}</span>
      <span className="numfield">
        <input
          className="field"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder={placeholder}
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
