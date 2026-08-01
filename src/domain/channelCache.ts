export interface CachedChannel {
  login: string
  /** `yyyy-mm-dd`. */
  createdAt: string
}

/** Enough to cover any realistic history without letting localStorage drift. */
export const CHANNEL_CACHE_LIMIT = 50

const normalize = (login: string) => login.trim().toLowerCase()

/**
 * The cache lives in localStorage, so its content is user-editable and may be
 * anything at all. Parsing therefore never throws: a corrupt cache is simply an
 * empty one, and the next write rebuilds it.
 */
function parse(raw: string | null): CachedChannel[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (entry): entry is CachedChannel =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as CachedChannel).login === 'string' &&
        typeof (entry as CachedChannel).createdAt === 'string',
    )
  } catch {
    return []
  }
}

/** A channel's creation date never changes, so a hit needs no revalidation. */
export function lookupChannel(raw: string | null, login: string): string | null {
  const wanted = normalize(login)
  return parse(raw).find((entry) => entry.login === wanted)?.createdAt ?? null
}

/** Most recently used last, so the cap forgets the channels left behind. */
export function rememberChannel(
  raw: string | null,
  login: string,
  createdAt: string,
  limit = CHANNEL_CACHE_LIMIT,
): string {
  const wanted = normalize(login)
  const kept = parse(raw).filter((entry) => entry.login !== wanted)

  return JSON.stringify([...kept, { login: wanted, createdAt }].slice(-limit))
}

const STORAGE_KEY = 'getclip.channels'

export const channelCache = {
  read: (login: string) => lookupChannel(localStorage.getItem(STORAGE_KEY), login),
  remember: (login: string, createdAt: string) =>
    localStorage.setItem(
      STORAGE_KEY,
      rememberChannel(localStorage.getItem(STORAGE_KEY), login, createdAt),
    ),
}
