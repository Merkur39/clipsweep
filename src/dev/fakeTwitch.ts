/**
 * A Twitch that answers offline.
 *
 * This module never ships. It is loaded from `main.tsx` behind
 * `import.meta.env.DEV` **and** a `?fake=` in the query, through a dynamic
 * import — so Rollup drops it from the production bundle rather than
 * tree-shaking around it. A test asserts that the built assets do not mention
 * it, because "it should be dropped" and "it was dropped" are different claims.
 *
 * ## Why the seam is `fetch`, and not an injected client
 *
 * Handing `TwitchApi` a fetcher would have been the tidier architecture and the
 * worse harness. Patching the transport leaves *every* line of the real pipeline
 * in play: URL building, the page cursor, the 100-id ceiling on `/games`, the
 * 429 back-off, the 60ms throttle, the 950-clip saturation threshold, the
 * bisection of a saturated window, and the refusal to bisect below six hours.
 * Those are the parts a mock at a higher level would quietly replace with an
 * assumption — and they are exactly the parts that produce the states the
 * interface exists to show. Nothing in `src/twitch/` changes for this.
 *
 * ## What it does not buy
 *
 * The clip player is a cross-origin iframe pointing at Twitch: it stays blank
 * offline, and no fixture can help. Everything up to it is real.
 */
import { tokenStore } from '../twitch/auth'
import type { Clip, Game, TwitchUser } from '../twitch/types'

/**
 * Deterministic by construction: the same scenario yields the same universe on
 * every reload, down to the clip. A visual check against random data is not a
 * check — the thing you noticed is gone by the time you look again.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (text: string) => {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Clip titles are product data, and stay French — as `messages.fr.ts` does. */
const TITLE_PARTS = [
  ['il ne fallait pas', 'personne ne comprend', 'la meilleure impro', 'le clutch'],
  ['le dire', 'la règle', 'de la soirée', 'à 1 HP', 'en direct', 'du stream'],
  ['', ' (rediff)', ' — la totale', ' vraiment', ''],
]

const CREATORS = [
  'Sardoche',
  'Kameto',
  'Ponce',
  'Etoiles',
  'ZeratoR',
  'squeezielive',
  'Mister_MV',
  'Antoine_Daniel',
]

const GAME_NAMES = [
  'Just Chatting',
  'Minecraft',
  'Grand Theft Auto V',
  'League of Legends',
  'Fortnite',
  'Counter-Strike 2',
  'Rocket League',
  'Valorant',
  'Dark Souls III',
  'Elden Ring',
]

/** How many game ids Helix no longer names. The filter must show their number. */
const RETIRED_GAMES = 2

export interface Scenario {
  /** Roughly how many clips the channel has, before the burst is added. */
  clips: number
  /** The year the channel was created. */
  since: number
  /**
   * A span too short to bisect holding more clips than a window may return:
   * the only way to reach a *lost* window, which no other fixture produces.
   * `bisect` refuses below twice the six-hour floor, so this is eight hours.
   */
  burst: boolean
  /** Simulated round trip, on top of the client's own 60ms throttle. */
  latencyMs: number
  /** One request in N answers 429, to exercise the back-off. */
  rateLimitEvery: number
  /** One request in N answers 500, to exercise the retry. */
  serverErrorEvery: number
  /** `/games` always fails: the filter falls back to bare ids. */
  gamesDown: boolean
  /** Helix answers 401 once this many clip requests have gone through. */
  expireAfter: number | null
}

const SCENARIOS: Record<string, Scenario> = {
  /** The everyday shape: a big channel, three saturated windows, one lost. */
  demo: {
    clips: 12_000,
    since: 2012,
    burst: true,
    latencyMs: 35,
    rateLimitEvery: 0,
    serverErrorEvery: 0,
    gamesDown: false,
    expireAfter: null,
  },
  /** Small and quick, for the states that only show when there is little. */
  small: {
    clips: 120,
    since: 2024,
    burst: false,
    latencyMs: 20,
    rateLimitEvery: 0,
    serverErrorEvery: 0,
    gamesDown: false,
    expireAfter: null,
  },
  /** Enough rows that the virtualiser is the only thing keeping the page up. */
  huge: {
    clips: 60_000,
    since: 2011,
    burst: true,
    latencyMs: 5,
    rateLimitEvery: 0,
    serverErrorEvery: 0,
    gamesDown: false,
    expireAfter: null,
  },
  /** A network that misbehaves without failing: back-off and retry, visibly. */
  flaky: {
    clips: 4_000,
    since: 2018,
    burst: false,
    latencyMs: 40,
    rateLimitEvery: 9,
    serverErrorEvery: 14,
    gamesDown: false,
    expireAfter: null,
  },
  /** Names unresolved: the filter shows ids, and the log says why. */
  'games-down': {
    clips: 2_000,
    since: 2020,
    burst: false,
    latencyMs: 25,
    rateLimitEvery: 0,
    serverErrorEvery: 0,
    gamesDown: true,
    expireAfter: null,
  },
  /** The token dies mid-sweep: the one path that empties the session on its own. */
  expired: {
    clips: 8_000,
    since: 2015,
    burst: false,
    latencyMs: 30,
    rateLimitEvery: 0,
    serverErrorEvery: 0,
    gamesDown: false,
    expireAfter: 12,
  },
}

export const SCENARIO_NAMES = Object.keys(SCENARIOS)

const FAKE_TOKEN = 'fake-token-offline-fixture'
const CHANNEL_ID = '51218086'

/**
 * A thumbnail that needs no network: a flat plate with the clip's own hue, as a
 * data URI. Real enough to prove the tile draws its image, and to leave the
 * missing-thumbnail stand-in reachable — one clip in nine carries none.
 */
function thumbnail(hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="hsl(${hue} 24% 32%)"/><circle cx="160" cy="90" r="34" fill="hsl(${hue} 30% 44%)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

interface Universe {
  user: TwitchUser
  /** Sorted by `created_at`, so a window is a slice found by binary search. */
  clips: Clip[]
  games: Game[]
}

const universes = new Map<string, Universe>()

function build(name: string, scenario: Scenario): Universe {
  const random = mulberry32(hash(name))
  const startMs = Date.UTC(scenario.since, 3, 12)
  const endMs = Date.now()
  const clips: Clip[] = []

  const push = (createdMs: number, index: number, viewFloor = 0) => {
    const roll = random()
    /* Views follow a power law, which is the whole reason the ranking bar and
       the logarithmic frieze exist: a linear spread would make both of them
       lie about a real channel. One clip in eleven has none at all — the case
       the sweep exists to unearth. */
    const views = roll < 0.09 ? 0 : Math.max(viewFloor, Math.round(Math.pow(roll, 6) * 240_000) + 1)
    const parts = TITLE_PARTS.map((bank) => bank[Math.floor(random() * bank.length)])
    const titled = random() > 0.06
    const long = random() < 0.05

    clips.push({
      id: `FakeClip${index}${name.replace(/[^A-Za-z0-9]/g, '')}`,
      url: `https://clips.twitch.tv/FakeClip${index}`,
      embed_url: `https://clips.twitch.tv/embed?clip=FakeClip${index}`,
      broadcaster_name: 'squeezielive',
      creator_name: CREATORS[Math.floor(Math.pow(random(), 2) * CREATORS.length)],
      // An empty title is what `table.untitled` answers; a very long one is what
      // the ellipsis in the title cell and the two-line tile clamp answer.
      title: !titled
        ? ''
        : long
          ? `${parts.join(' ')} — et là il se passe quelque chose que personne n'avait vu venir, pas même lui`
          : parts.join(' ').replace(/\s+/g, ' ').trim(),
      view_count: views,
      created_at: new Date(createdMs).toISOString(),
      thumbnail_url: random() < 0.11 ? '' : thumbnail(Math.floor(random() * 360)),
      duration: Math.round((8 + random() * 130) * 10) / 10,
      game_id: String(
        600_000 + Math.floor(Math.pow(random(), 2) * (GAME_NAMES.length + RETIRED_GAMES)),
      ),
    })
  }

  /* Clips grow with the channel rather than spreading evenly: an early year
     holds a handful and a recent one holds thousands, which is what makes the
     later windows saturate and the earlier ones not. */
  for (let i = 0; i < scenario.clips; i += 1) {
    const t = Math.pow(random(), 0.45)
    push(startMs + t * (endMs - startMs), i)
  }

  if (scenario.burst) {
    /* Eight hours holding more clips than a window may return. `bisect` refuses
       to split below twice the six-hour floor, so this window saturates, cannot
       be halved, and comes back *lost* — the third state of the frieze, which
       nothing else in this fixture reaches. */
    const burstStart = startMs + (endMs - startMs) * 0.72
    for (let i = 0; i < 1_400; i += 1) {
      push(burstStart + random() * 8 * 3_600_000, scenario.clips + i, 400)
    }
  }

  clips.sort((a, b) => a.created_at.localeCompare(b.created_at))

  return {
    user: {
      id: CHANNEL_ID,
      login: 'squeezielive',
      display_name: 'squeezielive',
      profile_image_url: thumbnail(210),
      created_at: new Date(startMs).toISOString(),
    },
    clips,
    // The retired ids are deliberately absent from this list: Helix returns no
    // row for a category it has dropped, and the filter must name them by id.
    games: GAME_NAMES.map((gameName, i) => ({ id: String(600_000 + i), name: gameName })),
  }
}

function universeFor(name: string, scenario: Scenario): Universe {
  const existing = universes.get(name)
  if (existing) return existing

  const built = build(name, scenario)
  universes.set(name, built)
  return built
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Helix never returns more than this for one query, however you paginate. */
const HELIX_WINDOW_CAP = 1000
const PAGE = 100

/**
 * The clips of one window, ordered as Helix orders them, computed once.
 *
 * Memoised on the window's own bounds, and that is not a micro-optimisation:
 * done per *request*, a filter over the whole universe plus a sort ran on all
 * 297 pages of a sweep instead of its 46 windows, and it ran on the main
 * thread. Measured before the fix, the fixture alone accounted for 35 long
 * tasks and 3.8 seconds of blocking — which is to say it produced the very
 * stutter one would then have gone looking for in React.
 *
 * A fixture that is slow does not merely waste time: it lies about the thing it
 * exists to measure.
 */
const slices = new Map<string, Clip[]>()

function windowSlice(clips: Clip[], startedAt: string, endedAt: string): Clip[] {
  const key = `${startedAt}|${endedAt}`
  const cached = slices.get(key)
  if (cached) return cached

  // The universe is sorted by `created_at`, so the range is two binary searches
  // rather than a pass. Only the ordering below is linearithmic, and only in
  // the size of the window.
  const lower = (bound: string) => {
    let low = 0
    let high = clips.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (clips[mid].created_at < bound) low = mid + 1
      else high = mid
    }
    return low
  }

  /* Helix orders a window by view count, which is what makes its 1000-row
     ceiling lose the *least* watched clips of a busy period — the very fact the
     sweep exists to work around. Ordering by date here would hand back a
     complete-looking list and hide the whole problem. */
  const slice = clips
    .slice(lower(startedAt), lower(endedAt))
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, HELIX_WINDOW_CAP)

  slices.set(key, slice)
  return slice
}

/**
 * Installs the fake. Returns the scenario it resolved, so the caller can say
 * which one is running and refuse an unknown name loudly rather than serving
 * something plausible.
 */
export function installFakeTwitch(name: string): Scenario {
  const scenario = SCENARIOS[name]
  if (!scenario) {
    throw new Error(`unknown ?fake= scenario "${name}" — try one of ${SCENARIO_NAMES.join(', ')}`)
  }

  const real = globalThis.fetch.bind(globalThis)
  let clipRequests = 0
  let flakeCounter = 0

  // A token, so the session establishes and the sweep button is live. Written
  // where the real one goes: the whole access path then runs unchanged.
  tokenStore.write(FAKE_TOKEN)

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      location.href,
    )

    // Anything that is not Twitch is left entirely alone — the dev server's own
    // module graph travels over this same function.
    if (!/(^|\.)twitch\.tv$/.test(url.hostname)) return real(input as RequestInfo, init)

    await sleep(scenario.latencyMs)

    if (url.pathname === '/oauth2/validate') {
      return json({ client_id: 'fake-client', expires_in: 4 * 24 * 3600 })
    }
    if (url.pathname === '/oauth2/revoke') return new Response(null, { status: 200 })

    const { user, clips, games } = universeFor(name, scenario)

    if (url.pathname === '/helix/users') {
      const login = url.searchParams.get('login')?.toLowerCase()
      return json({ data: login === user.login ? [user] : [] })
    }

    if (url.pathname === '/helix/games') {
      if (scenario.gamesDown) return json({ message: 'fixture: /games is down' }, 503)
      const wanted = new Set(url.searchParams.getAll('id'))
      return json({ data: games.filter((game) => wanted.has(game.id)) })
    }

    if (url.pathname === '/helix/clips') {
      clipRequests += 1
      if (scenario.expireAfter !== null && clipRequests > scenario.expireAfter) {
        return json({ message: 'fixture: token expired mid-sweep' }, 401)
      }

      flakeCounter += 1
      if (scenario.rateLimitEvery && flakeCounter % scenario.rateLimitEvery === 0) {
        return new Response(JSON.stringify({ message: 'fixture: rate limited' }), {
          status: 429,
          // A second out, which the client reads to size its wait.
          headers: { 'ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1) },
        })
      }
      if (scenario.serverErrorEvery && flakeCounter % scenario.serverErrorEvery === 0) {
        return json({ message: 'fixture: upstream hiccup' }, 500)
      }

      const startedAt = url.searchParams.get('started_at') ?? ''
      const endedAt = url.searchParams.get('ended_at') ?? ''
      const inWindow = windowSlice(clips, startedAt, endedAt)

      const offset = Number(url.searchParams.get('after') ?? '0')
      const page = inWindow.slice(offset, offset + PAGE)

      /* A cursor on every *full* page, including the last one, which then leads
         to an empty page. That is what Helix does, and the difference is not
         cosmetic: the collector breaks on a missing cursor **before** it tests
         its saturation threshold, so a window that returns the ceiling and stops
         offering a cursor is recorded as complete. Modelled the other way, this
         fixture reported "Complete — no clip missing" on a channel it had
         demonstrably truncated. See the note in the session summary: whether
         real Helix ever omits that cursor is not something this fixture can
         settle. */
      return json({
        data: page,
        pagination: page.length === PAGE ? { cursor: String(offset + PAGE) } : {},
      })
    }

    return json({ message: `fixture: unrouted ${url.pathname}` }, 404)
  }) as typeof fetch

  return scenario
}

/**
 * Forgets the fixture's token.
 *
 * Called when the page loads *without* a scenario: the token outlives the query
 * parameter that created it, and a stale one sends the app to the real Twitch
 * with a string it will refuse — an "expired token" with no cause on screen.
 * Only ever removes the fixture's own value.
 */
export function forgetFakeToken() {
  if (tokenStore.read() === FAKE_TOKEN) tokenStore.clear()
}
