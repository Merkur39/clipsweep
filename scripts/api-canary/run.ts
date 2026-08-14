/**
 * Probes Helix for the behaviours `assumptions.ts` describes, and hands the
 * workflow what it needs to open an issue.
 *
 * Runs on an app access token — the only kind that survives unattended, since
 * the implicit flow needs a browser and a human. That token is minted from a
 * client secret held as a repository secret: it never reaches the deployed app,
 * which stays what it is, a static site talking to Helix from the browser.
 *
 * Two failure modes, kept apart on purpose. A *drift* is what the canary exists
 * to catch: the run succeeds, the workflow opens an issue. A *probe failure* —
 * missing secret, network, 5xx, an unusable sample — must never open one: it
 * says nothing about Twitch, so it fails the job instead and stays visible in
 * the Actions tab.
 */
import process from 'node:process'

import {
  CEILING_BAND,
  checkCeiling,
  checkCursorShape,
  checkSortOrder,
  checkTokenLifetime,
  type Verdict,
} from './assumptions.ts'
import { emitReport } from './report.ts'

/** Relative to the workspace root, where `gh issue create` is run from. */
const ISSUE_BODY_PATH = 'canary-issue.md'

const HELIX = 'https://api.twitch.tv/helix'
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const PAGE_SIZE = 100
/** Courtesy spacing. The whole run costs about a dozen of the 800 points/min. */
const THROTTLE_MS = 100
/**
 * A walk that never ends would mean the cap is gone entirely. Stopping here
 * still yields the right verdict — anything this far above the band reads as
 * "raised" — the reported total is simply a floor rather than an exact count.
 */
const MAX_PAGES = 40

/** Fails the job without opening an issue: nothing was learned about Twitch. */
class ProbeError extends Error {}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new ProbeError(
      `${name} missing. The canary needs TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET as repository secrets.`,
    )
  }
  return value
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function mintAppToken(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (response.status === 401 || response.status === 403) {
    // Far more likely a rotated secret than Twitch closing the flow, so this
    // stays a probe failure rather than becoming a drift.
    throw new ProbeError(
      `Twitch refused the client_credentials grant (${response.status}). Check TWITCH_CLIENT_SECRET before suspecting an API change.`,
    )
  }
  if (!response.ok) throw new ProbeError(`Minting the app access token: HTTP ${response.status}`)

  const payload = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!payload.access_token || typeof payload.expires_in !== 'number') {
    throw new ProbeError('Unusable response from /oauth2/token.')
  }
  return { accessToken: payload.access_token, expiresInSeconds: payload.expires_in }
}

interface HelixPage<T> {
  data: T[]
  pagination?: { cursor?: string }
}

function helixGet<T>(
  path: string,
  params: Record<string, string>,
  auth: { clientId: string; accessToken: string },
): Promise<HelixPage<T>> {
  return (async () => {
    const response = await fetch(`${HELIX}/${path}?${new URLSearchParams(params)}`, {
      headers: { 'Client-Id': auth.clientId, Authorization: `Bearer ${auth.accessToken}` },
    })

    if (!response.ok) throw new ProbeError(`GET /${path} : HTTP ${response.status}`)
    return (await response.json()) as HelixPage<T>
  })()
}

async function main(): Promise<void> {
  const clientId = required('TWITCH_CLIENT_ID')
  const clientSecret = required('TWITCH_CLIENT_SECRET')
  /**
   * Must hold far more clips than the cap, so that where the walk stops can
   * only be Helix's doing. A channel that shrank below it turns the ceiling
   * probe ambiguous — which the verdict says out loud rather than guessing.
   */
  const channel = process.env.CANARY_CHANNEL || 'xqc'

  const { accessToken, expiresInSeconds } = await mintAppToken(clientId, clientSecret)
  const auth = { clientId, accessToken }

  const users = await helixGet<{ id: string }>('users', { login: channel }, auth)
  const broadcasterId = users.data[0]?.id
  if (!broadcasterId) throw new ProbeError(`Probe channel \`${channel}\` not found.`)

  // Deliberately naive: no started_at/ended_at. This is the walk the windowing
  // exists to work around, so it is the one that must be measured.
  const viewCounts: number[] = []
  let cursor: string | undefined
  let firstCursor: string | undefined
  let pages = 0

  while (pages < MAX_PAGES) {
    const params: Record<string, string> = {
      broadcaster_id: broadcasterId,
      first: String(PAGE_SIZE),
    }
    if (cursor) params.after = cursor

    const page = await helixGet<{ view_count: number }>('clips', params, auth)
    pages += 1
    for (const clip of page.data) viewCounts.push(clip.view_count)

    cursor = page.pagination?.cursor
    if (pages === 1) firstCursor = cursor
    if (!cursor || page.data.length === 0) break

    await sleep(THROTTLE_MS)
  }

  if (viewCounts.length < 2) {
    throw new ProbeError(
      `Only ${viewCounts.length} clip(s) read on \`${channel}\`: unusable sample.`,
    )
  }
  if (!firstCursor) {
    throw new ProbeError(
      `No cursor returned by the first page on \`${channel}\`: the channel fits in one page, the probe measures nothing.`,
    )
  }

  const verdicts: Verdict[] = [
    checkSortOrder(viewCounts),
    checkCeiling(viewCounts.length, CEILING_BAND),
    checkCursorShape(firstCursor, PAGE_SIZE),
    checkTokenLifetime(expiresInSeconds),
  ]

  emitReport(verdicts, { channel, bodyPath: ISSUE_BODY_PATH })
}

try {
  await main()
} catch (error) {
  if (error instanceof ProbeError) {
    console.error(`Probe failed: ${error.message}`)
    console.error('No issue opened — this failure says nothing about the Twitch API.')
  } else {
    console.error(error)
  }
  process.exitCode = 1
}
