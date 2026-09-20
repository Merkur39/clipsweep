/**
 * What a pagination cursor admits to.
 *
 * Helix shapes it as two nested base64 layers, `{"b":null,"a":{"Cursor":"<base64
 * offset>"}}`, the inner value being a decimal count of items the service
 * considers served. That count is not the number of clips it handed over.
 * Measured on 2026-09-20: a page asked at `first=100` came back with 97 clips
 * and a cursor reading 100. The three missing ones are not in the page, and the
 * next request starts past them — they are unreachable, and this offset is the
 * only place the response says so at all. The status is 200, `data` is a normal
 * array, and nothing else differs from a page that lost nothing.
 *
 * So it is read for what it says about the gap, never to paginate: the cursor
 * itself is passed back to Helix opaquely, as it always was. A reshaping on
 * Twitch's side must therefore cost the ledger and nothing else, which is why
 * every failure here is `null` rather than a throw.
 */
export function claimedOffset(cursor: string | undefined): number | null {
  if (!cursor) return null

  try {
    const outer: unknown = JSON.parse(atob(cursor))
    if (typeof outer !== 'object' || outer === null) return null

    const inner = (outer as { a?: { Cursor?: unknown } }).a?.Cursor
    if (typeof inner !== 'string') return null

    const offset = atob(inner)
    return /^\d+$/.test(offset) ? Number(offset) : null
  } catch {
    return null
  }
}
