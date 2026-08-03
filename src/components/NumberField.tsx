import { useTranslation } from '../i18n/LocaleProvider'
import { CloseIcon } from './Icon'

export interface NumberFieldProps {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
}

/**
 * A number input with an inline clear button. The button is absolutely
 * positioned inside the field: showing and hiding it must not move anything,
 * which is exactly what a conditionally rendered sibling would do.
 */
export function NumberField({ label, value, onChange, placeholder }: NumberFieldProps) {
  const { t } = useTranslation()
  const clear = t('filters.clearField', { label })

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">
        <input
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
