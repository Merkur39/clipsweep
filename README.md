# ClipSweep

Lists **every** clip on a Twitch channel — including the ones the site no longer shows you.

**→ [clipsweep.vercel.app](https://clipsweep.vercel.app/)**

> Independent project, **unaffiliated with Twitch Interactive, Inc.** "Twitch" is a trademark of its
> owner, used here to name the service the tool works with.

## Why

`GET /helix/clips?broadcaster_id=…` sorts by descending view count and **stops paginating past roughly
1000 results**. That is the ceiling that makes the website's "Top / All time" go quiet after a certain
point: clips with 3 or 6 views sit behind it, unreachable by scrolling. The API has exactly the same
limit — calling it naively changes nothing.

The way around it: cut the period into `started_at` / `ended_at` windows fine enough that each request
stays under the ceiling. Any window that saturates anyway (≥ 950 results with a cursor left) is **split
in two and replayed**, depth first, down to a 6-hour floor. Clips are deduplicated by `id`.

A window still saturated at the floor means clips remain out of reach: it is counted in `incomplete`,
drawn in red on the frieze, and called out by an alert. **The tool never claims completeness it has not
verified.**

The filters above the table are **optional** and purely local: everything is shown by default.

## Setup

Done **once**, by whoever hosts the app:

1. Create an application at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), category
   "Application Integration".
2. Declare every origin that serves the app under "OAuth Redirect URLs", verbatim and **trailing slash
   included**: `http://localhost:5173/` in development, plus the production URL.
3. `cp .env.example .env.local`, and paste `VITE_TWITCH_CLIENT_ID` into it.
4. `npm install && npm run dev`.

After that every visitor clicks "Connect to Twitch" and authenticates with **their own account** —
nothing to fill in, no configuration form. The Client ID identifies the application, not the person:
it is not a secret, it travels in the clear in the authorization URL and in every `Client-Id` header.

**There is no variable for the redirect URL**, and that is deliberate. `redirectUri()` derives it at
runtime from `location.origin + location.pathname`, normalized: by construction it is the exact place
the page is served from. Making it configurable would let it drift from reality, which produces a
`redirect_mismatch` that is miserable to diagnose. Only the list on Twitch's side is configured, at
step 2.

Without `VITE_TWITCH_CLIENT_ID` the app offers nothing to type: it displays the redirect URL to
declare, disables the connection, and points at `.env.local`.

The tokens it mints carry **no scope** ([auth.ts](src/twitch/auth.ts)): they unlock public data only —
never the email address, channel management, or moderation. That is what makes sharing one application
harmless in practice. What remains: the Twitch Developer Agreement holds the application's owner
accountable for the activity carried out under their Client ID.

No secret anywhere: implicit flow, the token comes back in the URL fragment and is kept in
`localStorage`, so a later visit finds the session still open. The browser talks to Helix directly
(CORS allows it), there is no backend — the build deploys as static files.

Keeping it is only defensible because "Disconnect" ends it: it calls `/oauth2/revoke`, which takes
the public client id and the token and no secret, and the token is dead on Twitch's side rather than
merely forgotten here. The forgetting never waits on that call — a click has to land whatever the
network is doing — so only its failure has anything to say, and it says both halves rather than
claiming a clean exit. What remains, and is the same bargain every site with a "stay signed in"
makes: a session abandoned without clicking anything sits there until the token expires.

## Deployment

`npm run build` produces a **static** site in `dist/`. There is no backend: the browser talks to Helix
directly, and nothing needs to run server-side. Any file host will do — an nginx on your own machine,
GitHub Pages, an S3 bucket, a continuous-deployment platform. A public instance runs at
[`clipsweep.vercel.app`](https://clipsweep.vercel.app/), but nothing in the code is tied to it.

Two settings, wherever it lands:

1. **`VITE_TWITCH_CLIENT_ID` at build time.** Vite inlines it into the bundle: it is a _build_
   variable, not a runtime one — setting it on the server that serves the files does nothing. A Client
   ID is not confidential; it ends up in the clear in the served bundle either way. Without it the
   build goes green and the site renders, but refuses every connection.
2. **The public URL declared under the Twitch application's "OAuth Redirect URLs"**, **trailing slash
   included**. Twitch compares the string byte for byte; the app normalizes the URI (trailing slash
   added, `index.html` stripped) so it is stable whatever path you arrive by.

`base: './'` in [vite.config.ts](vite.config.ts) makes asset paths relative: the build works at the
root of a domain as happily as under a sub-path — a GitHub Pages project page, for instance.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) deploys nothing — but nothing enters `main`
without it. It runs `format:check`, lint, tests, and build, and **branch protection** makes that the
condition of the merge: a direct push to `main` is refused, and a pull request only merges green.

That is what stands in for a gate, rather than any coupling between the two pipelines. A host wired to
the repository builds on the push webhook, without ever reading Actions results; both start in
parallel from the same commit. What is guarded is therefore entry into `main` — the only writer of the
production branch being the merge. Branch previews, on the other hand, go out regardless: that is
precisely what they are for.

Analytics (`@vercel/analytics`) is mounted in [main.tsx](src/main.tsx). It loads its script from
`/_vercel/insights/`, a path only Vercel hosting serves: **anywhere else the request fails without
consequence and nothing is measured**. Where it does work, it reports the page view and nothing more —
neither the channel swept, nor the clips, nor the token go through it.

## The two readouts

The same clips, in the same order, with the same selection, in two shapes — chosen at the end of the
"Results" label, one at a time:

| Readout    | What it is for                                                                |
| ---------- | ----------------------------------------------------------------------------- |
| Table      | the numbers: views, dates, and the zero-view clips the whole sweep exists for |
| Thumbnails | the clips themselves, a title saying little about what one is about to watch  |

Showing both at once would cost two virtualisers and a page twice as long, for nothing: the
selection is shared, so there is nothing to compare side by side. The choice lives in
`localStorage`, like the theme — it says how one likes to read, not what was being read.

Both are windowed, for the same reason: a sweep surfaces tens of thousands of clips, and that many
thumbnails would be as many requests as DOM nodes. The grid computes its own column count rather
than leaving it to `auto-fill` ([virtual.ts](src/components/virtual.ts)), and applies the thumbnail
height it computes instead of declaring an `aspect-ratio` in the sheet: two sources for one height
round differently, and the half pixel between them becomes a visible step down a slice of rows.

Nothing is checked by default. The selection stores what is **kept**, not what is excluded, so no
export ever carries a clip nobody pointed at. The counterpart is that a sweep ends with every export
disabled, which the blanket "Select all" on the count line exists to undo.

## Watching the clips

A play button on each row, and the tiles themselves, open the clip in a modal **on the page**:
leaving for Twitch would cost the page, and with it the results of the sweep, which live in memory
alone. From there one keeps or drops the clip and moves to the next, which is the gesture the
exports below are waiting for.

The player is Twitch's own embed in an iframe — the only way to play a clip, Helix exposing no media
URL (see the next section). `embedSrc` ([embed.ts](src/domain/embed.ts)) rebuilds its URL from the
slug alone, validated against an allowlist like the URLs injected into the generated scripts, and
names the embedding page in `parent`: Twitch refuses to play an embed whose `parent` does not name
its host. It is derived from `location.hostname`, for the same reason `redirectUri()` is derived
rather than configured.

The clip opens **paused**, and that is precisely what gives it its sound. A cross-origin iframe does
not inherit the click that opened it: Chrome grants unmuted playback only to a frame clicked in
itself, or to a host origin carrying enough media engagement — which `localhost` and a fresh
deployment do not have. Starting on its own therefore meant the player muting itself in order to
start at all, and the mute came back on every clip. The click on ▶ lands inside the frame, and it is
what unmutes, every time and on every origin.

Three limits are assumed rather than hidden. Once the focus is inside that iframe the arrow keys go
to Twitch and never reach us, hence the focus placed on "next" when the modal opens. A cross-origin
iframe cannot be asked whether it managed to load, hence the link to Twitch always offered. And
Twitch's end-of-clip recommendations cannot be turned off: the clip embed takes no such parameter,
and the JavaScript embed SDK — which does expose playback events — does not support clips at all.

## Downloading the videos

The Helix API exposes **no media URL**. The only real URL is a signed CloudFront one
(`?token=…&sig=…`), minted by an internal GQL endpoint reserved for Twitch's own web client. The
widespread trick of appending `.mp4` to `thumbnail_url` no longer works: the CDN ignores the suffix and
returns **the thumbnail** with a `200 OK` — a silent failure that yields 56 KB `.mp4` files.

Downloading is therefore delegated to [yt-dlp](https://github.com/yt-dlp/yt-dlp), running on the user's
machine. Two exports generate a ready-to-run script:

| Export | Use                                           |
| ------ | --------------------------------------------- |
| `.bat` | Windows: drop it in a folder, double-click it |
| `.sh`  | macOS / Linux: `chmod +x`, then run it        |

The script writes the URL list, calls yt-dlp with readable filenames, and keeps an `archive.txt`:
**running it again picks up where it stopped**. If yt-dlp is missing, it offers to fetch it — after
confirmation, never silently.

That yt-dlp is **disposable**: downloaded into the system's temporary folder, never next to the script,
and erased on the way out — including when the script is interrupted. A binary left on disk would never
be updated and would eventually stop being able to download; fetching it each time guarantees the
current version.

A yt-dlp **you installed yourself**, on the `PATH` or dropped next to the script, is used as-is and
never erased. The script only removes what it downloaded itself.

These scripts are code executed on the user's machine: URLs are injected into them after allowlist
validation ([scripts.ts](src/domain/scripts.ts)) — anything that is not provably a Twitch clip URL is
dropped rather than escaped.

## Architecture

| File                            | Role                                                      |
| ------------------------------- | --------------------------------------------------------- |
| `src/twitch/windows.ts`         | time-window seeding and bisection                         |
| `src/twitch/clips.ts`           | traversal, pagination, deduplication, completeness report |
| `src/twitch/auth.ts`            | implicit flow, token validation                           |
| `src/twitch/api.ts`             | Helix client: throttle, 429/5xx retry                     |
| `src/hooks/useClipSearch.ts`    | sweep orchestration, progress, log                        |
| `src/domain/filters.ts`         | display filters and facets                                |
| `src/components/Frieze.tsx`     | frieze of the time breakdown                              |
| `src/components/ClipTable.tsx`  | virtualized table — shows everything, no DOM ceiling      |
| `src/components/ClipGrid.tsx`   | virtualized board of thumbnails, measured then placed     |
| `src/components/virtual.ts`     | the windows both readouts are sliced by                   |
| `src/components/ClipPlayer.tsx` | the player, in a native `<dialog>`                        |
| `src/domain/embed.ts`           | the embed URL, from the slug and the host                 |
| `src/domain/selection.ts`       | what is kept, nothing being kept by default               |
| `src/domain/scripts.ts`         | `.bat` / `.sh` yt-dlp script generation                   |
| `src/i18n/`                     | French and English catalogues, detection and choice       |

The collection logic, the domain, and the components are covered by tests — Vitest for the logic,
Testing Library for rendering.

## Languages

The interface exists in **French** and **English**. On a first visit the language follows
`navigator.languages`, falling back to English when nothing matches; the explicit choice is made in the
masthead and lives in `localStorage`, like the theme. "Automatic" is not a third language but the
absence of a choice: it keeps following the browser.

No library — two languages, about a hundred keys, no lazy loading to organize. The engine fits in one
module ([translate.ts](src/i18n/translate.ts)): `{marker}` substitution, and plurals delegated to
`Intl.PluralRules` — French agrees "0 clip" in the singular where English says "0 clips". Numbers and
dates are formatted by type convention — a number is grouped in thousands, a `{ day }` is rendered in
the language's order — which spares the domain layer from knowing which language is being served.

`messages.fr.ts` is the reference catalogue: it defines the keys and their shape, and `messages.en.ts`
conforms to it through the type system, a missing key failing `typecheck` rather than at runtime.
Domain functions take `t` as an argument, never from context: they stay pure and testable outside
React.

The generated scripts' messages follow the language too, but stay **ASCII** — the console's code page
is not guaranteed and an accent would come out as garbage. Both "O" and "Y" are accepted as
confirmation, whichever language asked.

Two things stay deliberately in `yyyy-mm-dd`: field values and export contents. The first is the pivot
format of `<input type="date">`, the second is read back by machines. The native picker, for its part,
follows the **browser's** language rather than the page's: a French Chrome will show `jj/mm/aaaa` in an
English interface, which no HTML attribute fixes.

## Tuning

A sweep asks only for the channel and the date range. The window size is no longer a setting:
`splitByYear` seeds one window per calendar year, and bisection tightens where clips are dense.

That choice has a measurable cost. A saturated window spends ten requests before being split, and they
are wasted — the halves refetch the same clips. Starting from a single window over the whole range
would pay that toll at every internal node of the tree, roughly **three times** the requests of a
well-sized seeding. Year boundaries remove the top levels, the expensive ones, without asking the user
anything or probing a density the API cannot report.

The period opens on **the past month** rather than the channel's entire history: an immediate click on
"Start" should stay cheap instead of committing seven yearly windows before the period has been chosen.
The lower bound is clamped by the channel's creation date, resolved through Helix then kept in a local
cache ([channelCache.ts](src/domain/channelCache.ts)) capped at 50 entries.

Channel and period live in `sessionStorage`: they survive a tab reload, not the tab closing. They are
the parameters of a sweep, not preferences — carrying them from one session to the next would restart,
on the first click, a search nobody asked for. Durable alongside them: the theme, the language and the
choice of readout, the three that say how one reads rather than what was read — and the token, which
is not a parameter of a sweep but the right to run one at all.

The channel is the one exception, and it takes a tick to get: **Remember this channel**
([useRememberedChannel.ts](src/hooks/useRememberedChannel.ts)) mirrors the name typed into
`localStorage`, under a key of its own — `getclip.channel` keeps being erased at every boot, since what
a version prior to 2026-08-02 left there was never consented to. Whoever sweeps their own channel types
the same name at every opening; nobody else keeps anything. Unticking the box erases the name on the
spot rather than at the next opening. The clips
themselves live in memory alone: while a sweep is running or its results are on screen, leaving the
page asks for confirmation ([useUnloadGuard.ts](src/hooks/useUnloadGuard.ts)).

The filters above the table — min and max views, date range, creator, game — bear on display and
selection only, never on the sweep: narrowing the shown range restarts nothing, which is the whole
point. They are not persisted, not even for the tab's lifetime: a threshold forgotten between two
screens would produce an empty table for no apparent reason.

A starting sweep blanks them all, save the date range, which it opens on the period it is about to
cover: nothing outside that period will be collected, so the two bounds hold back nothing while giving
the fields a starting point to narrow from. What they then hide is judged against the clips actually
collected ([`narrowedRange`](src/domain/filters.ts)) — a bound reaching past them restricts nothing,
and the empty-table message must name the threshold on views rather than claim a range that hides
nothing.

Cost: ~1 request per 100 clips, plus one per bisection. Helix quota: 800 points/min; the client honors
`Ratelimit-Reset` on 429 and spaces requests 60 ms apart.

## What the sweep bets on

Helix promises less than the sweep needs. Some of the behaviours the windowing rests on are
**observed, never documented**: Twitch is free to change them without a note, and the tool would keep
running while returning less.

| Fact                                                      | Status                                         |
| --------------------------------------------------------- | ---------------------------------------------- |
| 800 points/min, one bucket per user per client ID         | documented                                     |
| `first` 1–100, RFC3339 dates, the three filters exclusive | documented                                     |
| `Ratelimit-*` headers, 429 when the bucket empties        | documented                                     |
| Clips sorted by descending view count                     | **observed**                                   |
| Pagination stops around 1000 results                      | **observed** — 1100 at `first=100`, 2026-08-14 |
| The cursor encodes an offset                              | **observed**                                   |
| A token lives some sixty days                             | observed through `expires_in`                  |

The ordering is the load-bearing one. A window that did not saturate is exhaustive, and what a
saturated one loses is its least-viewed clips — that is the whole claim. Lose the ordering and the
bisection still runs, but proves nothing.

The cap comes with a catch worth stating: it counts in reachable **offsets**, not in items, so the
same endpoint stops on a different total depending on the page size asked for. At `first=100` the
walk ends on 1100, at `first=24` it ends a hundred short of that. A figure measured at one page size
therefore says nothing about another, which is why `CEILING_BAND` is calibrated on the probe's own
walk rather than on anything read elsewhere.

So a canary measures them ([api-canary.yml](.github/workflows/api-canary.yml)), weekly and on demand.
It walks the pagination naively — no windowing, which is precisely the point — on a channel far
larger than the cap, then holds what it saw against what
[assumptions.ts](scripts/api-canary/assumptions.ts) claims. A drift opens an issue, assigned and
labelled `api-drift`; the same drift found twice does not open a second one.

A failing **probe** — missing secret, network, an unusable sample — opens nothing: it says nothing
about Twitch, so it fails the job and stays in the Actions tab instead.

Two repository secrets are needed, `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. The secret mints an
app access token, the only kind that survives unattended — the implicit flow needs a browser and a
human. It never leaves Actions: the deployed site stays what it is, a static bundle holding no
secret. The probe channel is set by `CANARY_CHANNEL` in the workflow, and must hold far more clips
than the cap, otherwise the walk measures the channel rather than Helix.

## Scripts

| Command                | Effect                    |
| ---------------------- | ------------------------- |
| `npm run dev`          | dev server                |
| `npm run preview`      | serves the `dist/` build  |
| `npm test`             | Vitest                    |
| `npm run test:watch`   | Vitest in watch mode      |
| `npm run typecheck`    | `tsc -b`                  |
| `npm run lint`         | ESLint                    |
| `npm run format`       | Prettier, write           |
| `npm run format:check` | Prettier, check           |
| `npm run build`        | static build into `dist/` |

| Command                          | Effect                                   |
| -------------------------------- | ---------------------------------------- |
| `node scripts/api-canary/run.ts` | probes the undocumented Helix behaviours |
| `node scripts/make-favicon.ts`   | regenerates the favicon                  |

Both take no dependency outside Node's standard library, and run without `npm install`.

Formatting is pinned by [.prettierrc](.prettierrc): single quotes, no semicolons, 100 columns. Those
values match the style already in place — Prettier's defaults (double quotes, semicolons, 80 columns)
would have rewritten the whole repository. `format:check` runs in CI, and branch protection makes it
the condition of the merge: a badly formatted file keeps `main` from moving, and therefore keeps the
site from going live.
