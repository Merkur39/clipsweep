/**
 * La date de début effective : jamais antérieure à la création de la chaîne.
 *
 * Une période qui commence avant l'existence de la chaîne ne peut rien rendre,
 * et coûte une fenêtre annuelle — donc au moins une requête — par année de
 * trop, plus autant de dalles vides dans la frise.
 *
 * La contrainte est **dérivée, pas écrite** : la saisie de l'utilisateur reste
 * telle quelle en mémoire, et redevient valable si la chaîne visée change pour
 * une plus ancienne. Écraser le champ ferait perdre une intention encore
 * légitime ailleurs.
 *
 * Les dates sont au format `yyyy-mm-dd`, où l'ordre lexicographique est l'ordre
 * chronologique.
 */
export function clampSince(since: string, channelCreatedAt: string | null): string {
  if (!channelCreatedAt) return since
  return since < channelCreatedAt ? channelCreatedAt : since
}

/**
 * La date de fin effective : jamais au-delà d'aujourd'hui.
 *
 * Le pendant de [clampSince] : aucun clip ne peut exister dans le futur, donc
 * les fenêtres au-delà d'aujourd'hui ne rendraient rien tout en dépensant une
 * requête chacune.
 *
 * Dérivée elle aussi, et pour une raison de plus : le temps avance. Une date
 * saisie trop loin devient légitime le jour venu — à condition de ne pas
 * l'avoir écrasée entre-temps.
 *
 * `today` s'exprime en UTC, comme la valeur par défaut du champ et comme les
 * bornes envoyées à Helix.
 */
export function clampUntil(until: string, today: string): string {
  return until > today ? today : until
}
