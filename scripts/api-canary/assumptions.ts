/**
 * The undocumented Helix behaviours the search is built on.
 *
 * Everything here is *observed*, never promised: Twitch documents neither the
 * view-count ordering, nor the pagination cap, nor the shape of a cursor. The
 * windowing in `src/twitch/windows.ts` only proves something as long as they
 * hold, and they would break in silence — the tool would keep running and keep
 * returning less. Hence a canary that measures them on a schedule.
 *
 * This module is pure on purpose: probing lives in `run.ts`, the verdicts are
 * decided here, and both are testable without touching the network.
 */

export type AssumptionId = 'sort-order' | 'pagination-ceiling' | 'cursor-shape' | 'token-lifetime'

export interface Verdict {
  id: AssumptionId
  /** What the assumption claims, in one line. Becomes the issue's heading. */
  claim: string
  status: 'holds' | 'drifted'
  /**
   * `critical` is what the search's correctness rests on; `info` is what would
   * merely be interesting to know. Both raise an issue — a drift is rare enough
   * that filtering it would cost more than it saves.
   */
  severity: 'critical' | 'info'
  /** What was actually measured, phrased so the issue needs no other context. */
  detail: string
}

/**
 * The band a full walk is expected to stop in.
 *
 * Measured at 1100 by the probe itself on 2026-08-14, at `first=100` — eleven
 * full pages. The figure only means anything at that page size: the cap counts
 * in reachable offsets rather than in items, so the same endpoint stops on a
 * different total when paged differently, and a number read at another page
 * size is not comparable. An earlier band was calibrated on 1006 seen through a
 * third party's interface at `first=24`, which put the expected value exactly
 * on the ceiling.
 *
 * The bounds are lopsided on purpose. A cap that dropped makes the search lose
 * clips in silence, so the floor stays close. A cap that rose is only an
 * invitation to lighten the windowing, and a real one would show in thousands
 * rather than in a hundred more — so the ceiling leaves room instead of crying
 * wolf over ordinary variation.
 */
export const CEILING_BAND = { min: 900, max: 2000 }

/** Sixty days is what `/oauth2/validate` has been returning for `expires_in`. */
const TOKEN_LIFETIME_BAND_DAYS = { min: 30, max: 90 }

/**
 * The ordering the whole strategy hangs on: a window that did not saturate is
 * exhaustive, and the clips missing from a saturated one are the least viewed.
 * Lose the ordering and the bisection still runs, but proves nothing.
 */
export function checkSortOrder(viewCounts: number[]): Verdict {
  const claim = '`/helix/clips` sorts by descending view count'

  for (let i = 1; i < viewCounts.length; i += 1) {
    const previous = viewCounts[i - 1]
    const current = viewCounts[i]
    if (current > previous) {
      return {
        id: 'sort-order',
        claim,
        status: 'drifted',
        severity: 'critical',
        detail: `Rank ${i}: ${previous} views followed by ${current}. The run no longer descends, so a saturated window no longer necessarily loses its least-viewed clips — the windowing guarantees nothing.`,
      }
    }
  }

  return {
    id: 'sort-order',
    claim,
    status: 'holds',
    severity: 'critical',
    detail: `${viewCounts.length} clips read in order, no inversion.`,
  }
}

/**
 * The cap itself. Walked with a channel large enough that the stop can only
 * come from Helix — a stop well below the band therefore accuses either the cap
 * or the probe channel, and the caller cannot tell which.
 */
export function checkCeiling(total: number, band: typeof CEILING_BAND): Verdict {
  const claim = 'Pagination of `/helix/clips` stops around 1000 results'
  const common = { id: 'pagination-ceiling', claim, severity: 'critical' } as const

  if (total > band.max) {
    return {
      ...common,
      status: 'drifted',
      detail: `The walk returned ${total} clips, past ${band.max}: the cap has been raised. Good news — the windowing could be lightened, or dropped altogether if pagination has become complete.`,
    }
  }

  if (total < band.min) {
    return {
      ...common,
      status: 'drifted',
      detail: `The walk stopped at ${total} clips, under ${band.min}. Two possible causes: the cap dropped — in which case the search is losing clips in silence — or the probe channel no longer holds enough clips to reach it, and it is the probe that needs changing.`,
    }
  }

  return {
    ...common,
    status: 'holds',
    detail: `The walk stopped at ${total} clips, inside the ${band.min}–${band.max} band.`,
  }
}

/**
 * The cursor's encoding. Informational: `collectClips` passes it back opaquely
 * and would survive any reshaping. It is watched because a change of encoding
 * is a change *in the endpoint*, and would be worth reading the release notes
 * for before the ordering breaks too.
 */
export function checkCursorShape(cursor: string, itemsConsumed: number): Verdict {
  const claim = 'The pagination cursor encodes an offset'
  const common = { id: 'cursor-shape', claim, severity: 'info' } as const
  const offset = decodeCursorOffset(cursor)

  if (offset === null) {
    return {
      ...common,
      status: 'drifted',
      detail: `Cursor \`${cursor.slice(0, 40)}\` no longer decodes to \`{"b":null,"a":{"Cursor":"<base64 offset>"}}\`.`,
    }
  }

  if (offset !== itemsConsumed) {
    return {
      ...common,
      status: 'drifted',
      detail: `The cursor carries offset ${offset} after ${itemsConsumed} clips read: it is no longer a plain count of items consumed.`,
    }
  }

  return {
    ...common,
    status: 'holds',
    detail: `Offset ${offset} after ${itemsConsumed} clips read.`,
  }
}

/** Two nested base64 layers, the inner one holding a decimal offset. */
function decodeCursorOffset(cursor: string): number | null {
  try {
    const payload: unknown = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
    if (typeof payload !== 'object' || payload === null) return null

    const inner = (payload as { a?: { Cursor?: unknown } }).a?.Cursor
    if (typeof inner !== 'string') return null

    const decoded = Buffer.from(inner, 'base64').toString('utf8')
    return /^\d+$/.test(decoded) ? Number(decoded) : null
  } catch {
    return null
  }
}

/**
 * How long a token stays good. Informational, but it decides the shape of the
 * connection: at sixty days one signs in and forgets, at four hours the search
 * would have to survive an expiry mid-run.
 */
export function checkTokenLifetime(expiresInSeconds: number): Verdict {
  const days = Math.round(expiresInSeconds / 86_400)
  const claim = 'A token lives some sixty days'
  const common = { id: 'token-lifetime', claim, severity: 'info' } as const

  if (days < TOKEN_LIFETIME_BAND_DAYS.min || days > TOKEN_LIFETIME_BAND_DAYS.max) {
    return {
      ...common,
      status: 'drifted',
      detail: `\`expires_in\` is ${expiresInSeconds} s, that is ${days} days, outside the ${TOKEN_LIFETIME_BAND_DAYS.min}–${TOKEN_LIFETIME_BAND_DAYS.max} day band.`,
    }
  }

  return { ...common, status: 'holds', detail: `\`expires_in\` is ${days} days.` }
}

export interface Summary {
  drifted: Verdict[]
  holding: Verdict[]
  shouldAlert: boolean
  /**
   * A stable fingerprint of *what* is drifting, carried in the issue body. Two
   * runs finding the same thing produce the same marker, which is what keeps
   * the canary from reopening or re-commenting an issue every week.
   */
  marker: string
}

export function summarize(verdicts: Verdict[]): Summary {
  const drifted = verdicts.filter((verdict) => verdict.status === 'drifted')
  const ids = drifted
    .map((verdict) => verdict.id)
    .sort()
    .join(',')

  return {
    drifted,
    holding: verdicts.filter((verdict) => verdict.status === 'holds'),
    shouldAlert: drifted.length > 0,
    marker: `<!-- api-canary drift=${ids || 'none'} -->`,
  }
}

export interface IssueContext {
  channel: string
  checkedAt: string
  runUrl: string
}

export function renderIssue(
  verdicts: Verdict[],
  { channel, checkedAt, runUrl }: IssueContext,
): { title: string; body: string } {
  const { drifted, holding, marker } = summarize(verdicts)
  const critical = drifted.some((verdict) => verdict.severity === 'critical')

  const title = `${critical ? 'The Twitch API has moved' : 'Minor drift on the Twitch API'}: ${drifted
    .map((verdict) => verdict.id)
    .join(', ')}`

  const body = [
    marker,
    '',
    'The canary measures the Helix behaviours the windowing depends on and no documentation promises. One of them has changed.',
    '',
    `Probe: channel \`${channel}\`, on ${checkedAt}. [Run log](${runUrl})`,
    '',
    '### What moved',
    '',
    ...drifted.flatMap((verdict) => [
      `- **${verdict.id}** — ${verdict.claim}`,
      `  ${verdict.detail}`,
      '',
    ]),
    ...(holding.length
      ? [
          '### What still holds',
          '',
          ...holding.map((verdict) => `- **${verdict.id}** — ${verdict.detail}`),
          '',
        ]
      : []),
    '### Where it lands',
    '',
    '`src/twitch/windows.ts` and `src/twitch/clips.ts` carry the bisection; `CEILING_BAND` in `scripts/api-canary/assumptions.ts` carries the expected value. Once the change is confirmed, that is where it is settled — and in the README\'s "What the search bets on" table.',
  ].join('\n')

  return { title, body }
}
