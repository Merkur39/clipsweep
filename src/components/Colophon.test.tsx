// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it } from 'vitest'

import { Colophon } from './Colophon'

afterEach(cleanup)

describe('Colophon', () => {
  // Every visitor receives the compiled bundle: that is a distribution of the
  // program, and the GPL-3.0 wants the corresponding source offered to them. The
  // repository is public, but the application still has to lead there.
  it('offers the source code', () => {
    render(<Colophon />)

    const source = screen.getByRole('link', { name: /code source/i })

    expect(source).toHaveAttribute('href', expect.stringContaining('github.com/Merkur39/clipsweep'))
    expect(source).toHaveTextContent(/GPL-3\.0/)
  })

  it('states the absence of any link with Twitch', () => {
    render(<Colophon />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/sans lien avec Twitch/i)
  })

  it('discloses the analytics', () => {
    render(<Colophon />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/audience/i)
  })

  it('recalls who the clips belong to', () => {
    render(<Colophon />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/auteurs/i)
  })

  // A link that replaces the page would lose the running sweep and the clips
  // collected, which live in the application's memory alone.
  it('opens every link in a new tab', () => {
    render(<Colophon />)

    const links = screen.getAllByRole('link')

    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    }
  })
})
