export interface Clip {
  id: string
  url: string
  embed_url: string
  broadcaster_name: string
  creator_name: string
  title: string
  view_count: number
  created_at: string
  thumbnail_url: string
  duration: number
  /** Helix returns the game id only; names come from /helix/games. */
  game_id: string
}

export interface Game {
  id: string
  name: string
}

export interface ClipPage {
  clips: Clip[]
  cursor?: string
}

export interface TwitchUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
  created_at: string
}

export interface Progress {
  windowsDone: number
  windowsTotal: number
  /**
   * Milliseconds of the searched period behind the search — the one measure of
   * it that only ever grows.
   *
   * A count of slices cannot: the total grows every time a saturated window is
   * halved, and `(done + 1) / (total + 2)` is smaller than `done / total`
   * whenever `total < 2 × done`. Dense years are the recent ones, so they split
   * late, which is exactly when that condition holds — and the bar slid
   * backwards. Only windows finished WITHOUT splitting are counted here; a
   * window that split has walked no ground, and its two halves will credit
   * between them precisely what it did not.
   */
  coveredMs: number
  /** Milliseconds of the whole seeded period. Fixed before the first request. */
  periodMs: number
  clipsFound: number
  requests: number
  /**
   * Which of the two passes is walking — see `DEFAULT_NARROW_PAGE_SIZE`.
   *
   * The wide one brings back very nearly everything for a tenth of the
   * requests: measured on 2026-09-21, 261 clips in 14 of 145 on `vinc33x`, 90
   * of 91 in 5 of 51 on `noxya__`. What follows is a verification that trickles,
   * and a reader who has their table has no reason to sit in front of it.
   */
  pass: 'wide' | 'narrow'
  /** Requests spent by the current pass on the window it is walking. */
  passDone: number
  /**
   * Requests that pass is expected to spend, or null when nothing can say.
   *
   * Nothing can, on the wide pass: how many clips a window holds is precisely
   * what it is being walked to find out. The narrow pass has it — the wide one
   * just counted the clips, and the narrow one costs one request per page of
   * them. So the bar has a denominator exactly when the long wait starts, and
   * goes without for the two seconds where it does not matter.
   */
  passTotal: number | null
}
