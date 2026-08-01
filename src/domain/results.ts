export interface EmptyResultsInput {
  /** A search has run at least once in this session. */
  searched: boolean
  /** Clips collected before the view filter is applied. */
  clipsFound: number
  maxViews: number | null
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`

/**
 * Why the table is empty, and what to do about it. Silence here is the worst
 * outcome: a filter that hides every clip looks exactly like a failed search.
 */
export function describeEmptyResults({
  searched,
  clipsFound,
  maxViews,
}: EmptyResultsInput): string {
  if (!searched) return 'Aucune fouille lancée.'
  if (clipsFound === 0) return 'Aucun clip sur cette période. Élargis l’intervalle de dates.'

  if (maxViews !== null) {
    return `${plural(clipsFound, 'clip')} récupéré${clipsFound > 1 ? 's' : ''}, aucun à ${plural(maxViews, 'vue')} ou moins. Relève « Vues max », ou vide le champ pour tout afficher.`
  }

  return `${plural(clipsFound, 'clip')} récupéré${clipsFound > 1 ? 's' : ''}, mais rien à afficher.`
}
