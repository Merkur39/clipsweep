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
 * Le pendant daté de [NumberField], jusqu'au bouton d'effacement superposé — un
 * champ date natif n'en offre aucun, et le vider au clavier demande de
 * sélectionner chaque segment.
 *
 * Les bornes grisent l'impossible dans le sélecteur, rien de plus : elles
 * n'appellent pas de `clamp`, contrairement à celles de la fouille. Une date
 * tapée hors étendue ne dépense aucune requête — elle vide la table, cas que le
 * message de table vide nomme.
 */
export function DateField({ label, value, onChange, min, max }: DateFieldProps) {
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
            aria-label={`Effacer ${label}`}
            title={`Effacer ${label}`}
          >
            <CloseIcon />
          </button>
        )}
      </span>
    </label>
  )
}
