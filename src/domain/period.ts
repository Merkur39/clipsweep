import type { T } from '../i18n/translate'

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

const pad = (value: number, width: number) => String(value).padStart(width, '0')

/**
 * Le mois qui précède une date `yyyy-mm-dd`, en UTC comme le reste des bornes.
 *
 * C'est la valeur par défaut du champ « Depuis » : une période d'un mois se
 * scanne en une poignée de requêtes, là où un début posé aux origines de
 * Twitch en dépense une par fenêtre annuelle — dépense qu'un clic immédiat sur
 * « Lancer le scan » engage sans que rien ne l'ait demandée.
 *
 * Le quantième est ramené au dernier jour du mois visé quand il n'y existe pas :
 * `setMonth` glisserait sur le mois suivant, et rendrait pour le 31 mars une
 * date postérieure à celle d'où l'on part.
 */
export function monthBefore(today: string): string {
  const [year, month, dayOfMonth] = today.split('-').map(Number)
  const previousMonth = month === 1 ? 12 : month - 1
  const previousYear = month === 1 ? year - 1 : year
  // Le jour 0 du mois suivant, soit le dernier du mois visé — années
  // bissextiles comprises.
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate()

  return `${pad(previousYear, 4)}-${pad(previousMonth, 2)}-${pad(Math.min(dayOfMonth, lastDay), 2)}`
}

/**
 * Le scan borne la fin à `23:59:59`, donc un début et une fin le même jour
 * couvrent bien cette journée-là : seul un début **postérieur** est fautif.
 *
 * Une même clé sert l'interface et le journal : le message que lit celui qui
 * corrige la période doit être celui qu'on retrouve dans la trace technique.
 */
export function describePeriodError(since: string, until: string, t: T): string | null {
  return since > until ? t('period.order') : null
}
