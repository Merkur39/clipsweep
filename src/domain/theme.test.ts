// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { applyTheme, parseTheme, THEMES } from './theme'

const root = () => document.documentElement

describe('parseTheme', () => {
  it('rend les trois choix tels quels', () => {
    for (const theme of THEMES) {
      expect(parseTheme(theme)).toBe(theme)
    }
  })

  it('retombe sur le suivi du système sans préférence enregistrée', () => {
    expect(parseTheme(null)).toBe('system')
  })

  // La préférence vit en localStorage : elle peut avoir été triturée à la main.
  it('retombe sur le suivi du système plutôt que d’appliquer n’importe quoi', () => {
    for (const corrompu of ['', 'clair', 'LIGHT', '{}', 'null']) {
      expect(parseTheme(corrompu)).toBe('system')
    }
  })
})

describe('applyTheme', () => {
  it('marque le choix explicite sur la racine', () => {
    applyTheme(root(), 'light')

    expect(root().getAttribute('data-theme')).toBe('light')
  })

  it('remplace un choix précédent au lieu de s’y ajouter', () => {
    applyTheme(root(), 'light')
    applyTheme(root(), 'dark')

    expect(root().getAttribute('data-theme')).toBe('dark')
  })

  // Suivre le système, c'est ne rien affirmer : l'attribut doit disparaître,
  // sans quoi `color-scheme` resterait restreint à la branche précédente.
  it('efface toute marque quand on revient au système', () => {
    applyTheme(root(), 'dark')
    applyTheme(root(), 'system')

    expect(root().hasAttribute('data-theme')).toBe(false)
  })
})
