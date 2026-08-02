import type { Progress } from '../twitch/types'
import { formatCount } from './numbers'

export interface EmptyResultsInput {
  /** A search has run at least once in this session. */
  searched: boolean
  /** A search is under way: nothing about the outcome is settled yet. */
  running: boolean
  /** Clips collected before the view filter is applied. */
  clipsFound: number
  maxViews: number | null
  /** Plage d'affichage, en `yyyy-mm-dd`. Deux bornes nulles : pas de plage. */
  period?: { from: string | null; to: string | null }
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${formatCount(count)} ${count > 1 ? pluralForm : singular}`

/** Accord d'un participe seul, sans son nom. */
const agree = (count: number, word: string) => `${word}${count > 1 ? 's' : ''}`

export interface SearchStatusInput {
  running: boolean
  progress: Progress | null
  clipsFound: number
}

/**
 * Une ligne d'état lisible sans rien connaître de l'algorithme. Elle remplace,
 * pour l'essentiel des visiteurs, la frise et les compteurs techniques : ceux-ci
 * répondent à « comment », celle-ci à « où ça en est ».
 */
export function describeSearchStatus({
  running,
  progress,
  clipsFound,
}: SearchStatusInput): string | null {
  if (!progress) return null

  if (running) {
    return `Fouille en cours — ${formatCount(progress.windowsDone)}/${formatCount(progress.windowsTotal)} périodes, ${plural(progress.clipsFound, 'clip')} trouvé${agree(progress.clipsFound, '')}.`
  }

  const total = clipsFound || progress.clipsFound
  return `Fouille terminée — ${plural(total, 'clip')} ${agree(total, 'trouvé')}.`
}

export interface ResultCountInput {
  /** Avant tout filtre. */
  found: number
  /** Après les filtres d'affichage. */
  shown: number
  selected: number
}

/** Les trois nombres qui comptent, toujours dans le même ordre. */
export function describeResultCount({ found, shown, selected }: ResultCountInput): string {
  if (found === 0) return ''

  return [
    `${plural(found, 'clip')} ${agree(found, 'récupéré')}`,
    `${formatCount(shown)} ${agree(shown, 'affiché')}`,
    `${formatCount(selected)} ${agree(selected, 'sélectionné')}`,
  ].join(' · ')
}

/**
 * Why the table is empty, and what to do about it. Silence here is the worst
 * outcome: a filter that hides every clip looks exactly like a failed search.
 */
/** La plage telle qu'on la lit, selon les bornes réellement posées. */
function describeRange(from: string | null, to: string | null): string | null {
  if (from && to) return `entre le ${from} et le ${to}`
  if (from) return `à partir du ${from}`
  if (to) return `jusqu’au ${to}`
  return null
}

export function describeEmptyResults({
  searched,
  running,
  clipsFound,
  maxViews,
  period,
}: EmptyResultsInput): string {
  if (!searched) return 'Aucune fouille lancée.'

  // Une fouille dure de quelques secondes à plusieurs minutes. Conclure à
  // l'absence de clips avant que la première période ait rendu est faux — et le
  // conseil qui suit (« élargis l'intervalle ») ferait recommencer pour rien.
  if (running && clipsFound === 0) return 'Fouille en cours — les premiers clips arrivent.'

  if (clipsFound === 0) return 'Aucun clip sur cette période. Élargis l’intervalle de dates.'

  // Nommée avant le seuil de vues quand les deux sont actifs : la plage est ce
  // que l'utilisateur vient de resserrer à la main, et c'est elle que l'action
  // de la table vide propose de rouvrir.
  const range = describeRange(period?.from ?? null, period?.to ?? null)
  if (range !== null) {
    return `${plural(clipsFound, 'clip')} ${agree(clipsFound, 'récupéré')}, aucun ${range}. Élargis la plage « Du / Au », ou vide les champs pour tout afficher.`
  }

  if (maxViews !== null) {
    return `${plural(clipsFound, 'clip')} récupéré${clipsFound > 1 ? 's' : ''}, aucun à ${plural(maxViews, 'vue')} ou moins. Relève « Vues max », ou vide le champ pour tout afficher.`
  }

  return `${plural(clipsFound, 'clip')} récupéré${clipsFound > 1 ? 's' : ''}, mais rien à afficher.`
}
