/**
 * The shape vocabulary of messages, isolated from both their content and their
 * rendering: the catalogues and the engine each refer to it without citing each
 * other.
 */

/**
 * A message whose shape depends on a count. Two forms are enough for the two
 * languages handled; it is `Intl.PluralRules` that decides which, not a
 * hand-written comparison — French agrees "0 clip" in the singular where English
 * says "0 clips".
 */
export interface Plural {
  one: string
  other: string
}

export type Message = string | Plural

/** A day to format in the current language, as `yyyy-mm-dd` or timestamped. */
export interface DayParam {
  day: string
}

/**
 * The values substituted into the `{markers}`.
 *
 * The type carries the formatting conventions, which spares callers from knowing
 * which language is being served:
 *
 * - a **number** is a count meant to be read, so grouped in thousands;
 * - a **`{ day }`** is a date, rendered in the language's order;
 * - a **string** passes through as it is — the escape hatch for an identifier, a
 *   year, an HTTP code, or an already translated segment.
 */
export type Params = Record<string, string | number | DayParam>
