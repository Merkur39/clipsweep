// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { render } from '../test-render'
import { afterEach, describe, expect, it } from 'vitest'

import { Colophon } from './Colophon'

afterEach(cleanup)

describe('Colophon', () => {
  // Chaque visiteur reçoit le bundle compilé : c'est une distribution du
  // programme, et la GPL-3.0 veut que la source correspondante lui soit offerte.
  // Le dépôt est public, encore faut-il que l'application y mène.
  it('offre le code source', () => {
    render(<Colophon />)

    const source = screen.getByRole('link', { name: /code source/i })

    expect(source).toHaveAttribute('href', expect.stringContaining('github.com/Merkur39/clipsweep'))
    expect(source).toHaveTextContent(/GPL-3\.0/)
  })

  it('annonce l’absence de lien avec Twitch', () => {
    render(<Colophon />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/sans lien avec Twitch/i)
  })

  it('informe de la mesure d’audience', () => {
    render(<Colophon />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/audience/i)
  })

  it('rappelle à qui appartiennent les clips', () => {
    render(<Colophon />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/auteurs/i)
  })

  // Un lien qui remplace la page perdrait le scan en cours et les clips
  // récupérés, qui ne vivent que dans la mémoire de l'application.
  it('ouvre chaque lien dans un nouvel onglet', () => {
    render(<Colophon />)

    const links = screen.getAllByRole('link')

    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    }
  })
})
