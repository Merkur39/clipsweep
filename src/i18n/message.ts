/**
 * Le vocabulaire de forme des messages, isolé de leur contenu comme de leur
 * rendu : les catalogues et le moteur s'y réfèrent tous deux sans se citer.
 */

/**
 * Un message dont la forme dépend d'un décompte. Deux formes suffisent aux deux
 * langues traitées ; c'est `Intl.PluralRules` qui tranche laquelle, et non une
 * comparaison écrite à la main — le français accorde « 0 clip » au singulier là
 * où l'anglais dit « 0 clips ».
 */
export interface Plural {
  one: string
  other: string
}

export type Message = string | Plural

/** Un jour à formater dans la langue courante, en `yyyy-mm-dd` ou horodaté. */
export interface DayParam {
  day: string
}

/**
 * Les valeurs substituées aux `{marqueurs}`.
 *
 * Le type porte les conventions de formatage, ce qui dispense les appelants de
 * connaître la langue servie :
 *
 * - un **nombre** est un décompte destiné à être lu, donc groupé par milliers ;
 * - un **`{ day }`** est une date, rendue dans l'ordre de la langue ;
 * - une **chaîne** traverse telle quelle — c'est l'échappatoire d'un
 *   identifiant, d'une année, d'un code HTTP, ou d'un segment déjà traduit.
 */
export type Params = Record<string, string | number | DayParam>
