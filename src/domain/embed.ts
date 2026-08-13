/**
 * Twitch clip slugs, and nothing else. The value ends up in the `src` of an
 * iframe: anything that is not provably a slug is dropped rather than escaped —
 * an allowlist has no bypass to reason about. Same doctrine as the clip URLs
 * injected into the generated scripts (`scripts.ts`).
 */
const SLUG = /^[A-Za-z0-9_-]{1,128}$/
/**
 * A bare host name: no port, no path, no scheme. `location.hostname` gives
 * exactly that — `location.host` would carry the dev server's port, which
 * Twitch rejects.
 */
const HOSTNAME = /^[A-Za-z0-9.-]{1,253}$/

/**
 * The player URL for a clip, or null when it cannot be built from values we
 * trust. The caller then offers the Twitch link rather than an iframe.
 *
 * `parent` is not optional decoration: Twitch refuses to play an embed whose
 * `parent` does not name the page hosting it. It is derived from the location
 * at call time, like `redirectUri()` — a configured value could drift from
 * reality, and the failure it produces is miserable to diagnose.
 */
export function embedSrc(slug: string, hostname: string): string | null {
  if (!SLUG.test(slug) || !HOSTNAME.test(hostname)) return null

  /**
   * No autoplay, and that is precisely what buys the sound.
   *
   * A cross-origin frame does not inherit the click that opened it: Chrome
   * grants unmuted playback only to a frame clicked in itself, or to a host
   * origin carrying enough media engagement — which a fresh deployment, and
   * `localhost` above all, does not have. Starting on its own therefore meant
   * the player muting itself in order to start at all, and the mute came back on
   * every clip, an unmuting made by hand not surviving the next one.
   *
   * Left paused, the clip waits for a click on its own play button. That click
   * lands inside the frame, which is what makes the sound possible — every
   * time, on every origin, at the cost of one click and to the gain of the
   * opening seconds.
   *
   * Both values are stated even where they match the embed's defaults: they are
   * a decision here, not something inherited.
   */
  const params = new URLSearchParams({
    clip: slug,
    parent: hostname,
    autoplay: 'false',
    muted: 'false',
  })
  return `https://clips.twitch.tv/embed?${params}`
}
