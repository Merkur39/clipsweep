const FR = new Intl.NumberFormat('fr-FR')

/**
 * Les séparateurs sont construits par point de code plutôt qu'écrits :
 * en clair ce sont des caractères invisibles, indiscernables à la relecture
 * comme au diff, et l'un d'eux est justement le bogue qu'on corrige ici.
 */
/** Espace fine insécable, et espace fine. */
const THIN_SPACES = new RegExp(`[${String.fromCharCode(0x202f, 0x2009)}]`, 'g')
/** Insécable ordinaire : présente partout, et de la largeur d'un chiffre. */
const NBSP = String.fromCharCode(0x00a0)

/**
 * Un nombre destiné à être lu, groupé par milliers.
 *
 * `Intl` sépare les tranches par une espace **fine** insécable en fr-FR, que
 * plusieurs polices monospace n'ont pas : elle se replie alors sur un glyphe de
 * largeur différente et désaligne la colonne des vues, que `tabular-nums`
 * venait justement de rendre comparable. On la normalise donc.
 *
 * Réservé à l'affichage. Les exports CSV, JSON et la liste d'URLs sortent les
 * valeurs brutes : elles sont relues par des machines.
 */
export function formatCount(value: number): string {
  return FR.format(value).replace(THIN_SPACES, NBSP)
}
