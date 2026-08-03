export interface AxisTick {
  time: number
  label: string
}

/** Past this, labels touch each other on a plot of ordinary width. */
const MAX_TICKS = 12

/**
 * The ticks of the time axis: one per 1 January contained in the period.
 *
 * Thinning only applies beyond what the width can carry. The previous step
 * capped at eight ticks and therefore skipped every other year from nine years
 * of sweep onwards: the edge columns — often partial years, so narrower than
 * their neighbours — ended up with no date beneath them at all, which made them
 * look truncated when they are exact.
 *
 * The period's own bounds do not appear here: their label carries a full date,
 * some sixty pixels wide, which would overlap the neighbouring 1 January. The
 * threshold that would avoid it is expressed in pixels, the ticks' position in
 * percent — irreconcilable at every width. The period is therefore stated in the
 * readout line, under the plot.
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
