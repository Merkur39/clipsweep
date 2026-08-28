// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it } from 'vitest'

import { Footer } from './Footer'

describe('Footer', () => {
  // Every visitor receives the compiled bundle: that is a distribution of the
  // program, and the GPL-3.0 wants the corresponding source offered to them. The
  // repository is public, but the application still has to lead there.
  it('offers the source code', () => {
    render(<Footer />)

    const source = screen.getByRole('link', { name: /code source/i })

    expect(source).toHaveAttribute('href', expect.stringContaining('github.com/Merkur39/clipsweep'))
    expect(source).toHaveTextContent(/GPL-3\.0/)
  })

  it('states the absence of any link with Twitch', () => {
    render(<Footer />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/sans lien avec Twitch/i)
  })

  it('discloses the analytics', () => {
    render(<Footer />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/audience/i)
  })

  it('recalls who the clips belong to', () => {
    render(<Footer />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/auteurs/i)
  })

  /* The other half of what the GPL asks a distribution to carry: the licence is
     on the source link, and this names whose work it licenses. Untranslated on
     purpose — it holds a symbol, a year and a name, and none of the three says
     anything different in the other language. */
  it('names the copyright holder', () => {
    render(<Footer />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 Merkur39')
  })

  // A link that replaces the page would lose the running search and the clips
  // collected, which live in the application's memory alone.
  it('opens every link in a new tab', () => {
    render(<Footer />)

    const links = screen.getAllByRole('link')

    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    }
  })
})
