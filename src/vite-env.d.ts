/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client ID of the registered Twitch application. Public by design. */
  readonly VITE_TWITCH_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
