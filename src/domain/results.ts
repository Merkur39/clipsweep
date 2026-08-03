import type { T } from '../i18n/translate'
import type { Progress } from '../twitch/types'

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
export function describeSearchStatus(
  { running, progress, clipsFound }: SearchStatusInput,
  t: T,
): string | null {
  if (!progress) return null

  if (running) {
    return t('results.status.running', {
      done: progress.windowsDone,
      total: progress.windowsTotal,
      n: progress.clipsFound,
    })
  }

  return t('results.status.done', { n: clipsFound || progress.clipsFound })
}

export interface ResultCountInput {
  /** Avant tout filtre. */
  found: number
  /** Après les filtres d'affichage. */
  shown: number
  selected: number
}

/**
 * Les trois nombres qui comptent, toujours dans le même ordre.
 *
 * Trois segments joints, et non une phrase : chaque nombre s'accorde sur
 * lui-même, ce qu'aucune forme unique ne saurait faire. Le séparateur est
 * neutre, donc il n'appartient à aucune des deux langues.
 */
export function describeResultCount({ found, shown, selected }: ResultCountInput, t: T): string {
  if (found === 0) return ''

  return [
    t('results.count.found', { n: found }),
    t('results.count.shown', { n: shown }),
    t('results.count.selected', { n: selected }),
  ].join(' · ')
}

/** La plage telle qu'on la lit, selon les bornes réellement posées. */
function describeRange(from: string | null, to: string | null, t: T): string | null {
  if (from && to) return t('results.range.between', { from: { day: from }, to: { day: to } })
  if (from) return t('results.range.from', { from: { day: from } })
  if (to) return t('results.range.to', { to: { day: to } })
  return null
}

/**
 * Why the table is empty, and what to do about it. Silence here is the worst
 * outcome: a filter that hides every clip looks exactly like a failed search.
 */
export function describeEmptyResults(
  { searched, running, clipsFound, maxViews, period }: EmptyResultsInput,
  t: T,
): string {
  if (!searched) return t('results.empty.notSearched')

  // Un scan dure de quelques secondes à plusieurs minutes. Conclure à
  // l'absence de clips avant que la première période ait rendu est faux — et le
  // conseil qui suit (« élargis l'intervalle ») ferait recommencer pour rien.
  if (running && clipsFound === 0) return t('results.empty.running')

  if (clipsFound === 0) return t('results.empty.nothing')

  // Nommée avant le seuil de vues quand les deux sont actifs : la plage est ce
  // que l'utilisateur vient de resserrer à la main, et c'est elle que l'action
  // de la table vide propose de rouvrir.
  const range = describeRange(period?.from ?? null, period?.to ?? null, t)
  if (range !== null) return t('results.empty.outOfRange', { n: clipsFound, range })

  if (maxViews !== null) {
    return t('results.empty.aboveViews', {
      n: clipsFound,
      max: t('results.views', { n: maxViews }),
    })
  }

  return t('results.empty.filtered', { n: clipsFound })
}
