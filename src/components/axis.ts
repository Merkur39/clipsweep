export interface AxisTick {
  time: number
  label: string
}

/** Au-delà, les étiquettes se touchent sur un tracé de largeur courante. */
const MAX_TICKS = 12

/**
 * Les repères de l'axe temporel : un par 1er janvier contenu dans la période.
 *
 * L'éclaircissement ne s'applique qu'au-delà de ce que la largeur peut porter.
 * Le pas précédent plafonnait à huit repères et sautait donc une année sur deux
 * dès neuf ans de fouille : les colonnes de bord — souvent des années
 * partielles, donc plus étroites que leurs voisines — se retrouvaient sans
 * aucune date en dessous, ce qui les faisait passer pour tronquées alors
 * qu'elles sont exactes.
 *
 * Les bornes de la période ne figurent pas ici : leur étiquette porte une date
 * complète, large d'une soixantaine de pixels, qui chevaucherait le 1er janvier
 * voisin. Le seuil qui l'éviterait s'exprime en pixels, la position des repères
 * en pourcentage — inconciliables à toutes les largeurs. La période est donc
 * énoncée dans la ligne de lecture, sous le tracé.
 */
export function axisTicks(from: number, to: number): AxisTick[] {
  if (to <= from) return []

  const years: number[] = []
  for (
    let year = new Date(from).getUTCFullYear();
    year <= new Date(to).getUTCFullYear();
    year += 1
  ) {
    const time = Date.UTC(year, 0, 1)
    if (time >= from && time <= to) years.push(year)
  }

  const stride = Math.ceil(years.length / MAX_TICKS) || 1
  return years
    .filter((_, index) => index % stride === 0)
    .map((year) => ({ time: Date.UTC(year, 0, 1), label: String(year) }))
}
