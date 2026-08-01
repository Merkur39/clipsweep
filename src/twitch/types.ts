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
  clipsFound: number
  requests: number
}
