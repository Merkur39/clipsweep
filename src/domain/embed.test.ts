import { describe, expect, it } from 'vitest'

import { embedSrc } from './embed'

const slug = 'AwkwardHelplessSalamanderSwiftRage'

describe('embedSrc', () => {
  it('builds the player URL for a clip', () => {
    const src = new URL(embedSrc(slug, 'clipsweep.vercel.app')!)

    expect(src.origin + src.pathname).toBe('https://clips.twitch.tv/embed')
    expect(src.searchParams.get('clip')).toBe(slug)
  })

  // Twitch refuses to play an embed whose `parent` does not name the page
  // hosting it: without this parameter the modal shows an error, not a clip.
  it('names the embedding page', () => {
    const src = new URL(embedSrc(slug, 'localhost')!)

    expect(src.searchParams.get('parent')).toBe('localhost')
  })

  /**
   * The two go together, and they are what buys the sound: a cross-origin frame
   * does not inherit the click that opened it, so a clip starting on its own
   * starts muted. Left paused, it waits for a click on its own play button —
   * a gesture inside the frame, which is what unmutes it for good.
   */
  it('leaves the clip paused, and its sound on', () => {
    const src = new URL(embedSrc(slug, 'localhost')!)

    expect(src.searchParams.get('autoplay')).toBe('false')
    expect(src.searchParams.get('muted')).toBe('false')
  })

  /**
   * An allowlist, as in `scripts.ts`: what is not provably a clip slug is
   * dropped rather than escaped. The caller then offers the Twitch link instead
   * of an iframe — there is nothing to reason about in a bypass that cannot
   * happen.
   */
  it('refuses a slug carrying anything but its own characters', () => {
    expect(embedSrc(`${slug}&parent=evil.example`, 'localhost')).toBeNull()
    expect(embedSrc('../../embed', 'localhost')).toBeNull()
    expect(embedSrc('', 'localhost')).toBeNull()
  })

  it('refuses anything that is not a bare host name', () => {
    expect(embedSrc(slug, 'localhost:5173')).toBeNull()
    expect(embedSrc(slug, 'evil.example/clipsweep.vercel.app')).toBeNull()
    expect(embedSrc(slug, '')).toBeNull()
  })
})
