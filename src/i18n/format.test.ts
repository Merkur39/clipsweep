import { describe, expect, it } from 'vitest'

import { formatCount, formatDay } from './format'

describe('formatCount', () => {
  it('laisse les petits nombres intacts', () => {
    expect(formatCount(0, 'fr')).toBe('0')
    expect(formatCount(999, 'en')).toBe('999')
  })

  it('groupe les milliers selon la langue', () => {
    expect(formatCount(1234567, 'en')).toBe('1,234,567')
    expect(formatCount(412, 'fr')).toBe('412')
  })

  it('groupe chaque tranche', () => {
    const nbsp = String.fromCharCode(0x00a0)

    expect(formatCount(1000, 'fr')).toBe(`1${nbsp}000`)
    expect(formatCount(20000, 'fr')).toBe(`20${nbsp}000`)
  })

  // Une espace sécable romprait la colonne en fin de ligne.
  it('n’emploie aucune espace sécable', () => {
    expect(formatCount(1234567, 'fr')).not.toContain(' ')
  })

  /**
   * `Intl` sépare les tranches par une espace **fine** insécable en fr-FR, que
   * plusieurs polices monospace n'ont pas : elle se replie alors sur un glyphe
   * de largeur différente et désaligne la colonne des vues, que `tabular-nums`
   * venait justement de rendre comparable.
   */
  it('normalise l’espace fine française en insécable ordinaire', () => {
    const formatted = formatCount(1234567, 'fr')

    expect(formatted).toBe(`1${String.fromCharCode(0x00a0)}234${String.fromCharCode(0x00a0)}567`)
    expect(formatted).not.toMatch(new RegExp(`[${String.fromCharCode(0x202f, 0x2009)}]`))
  })
})

describe('formatDay', () => {
  it('rend le quantième dans l’ordre de la langue', () => {
    expect(formatDay('2026-08-03', 'fr')).toBe('03/08/2026')
    expect(formatDay('2026-08-03', 'en')).toBe('08/03/2026')
  })

  // Les bornes de scan, `created_at` et les fenêtres arrivent tantôt en jour
  // seul, tantôt en horodatage complet.
  it('accepte un horodatage complet comme un jour seul', () => {
    expect(formatDay('2026-08-03T22:41:07Z', 'fr')).toBe('03/08/2026')
  })

  /**
   * Tout le reste de l'outil raisonne en UTC — les bornes envoyées à Helix, la
   * valeur par défaut des champs, le découpage des fenêtres. Un formatage en
   * heure locale décalerait l'affichage d'un jour à l'ouest de Greenwich, et le
   * jour affiché ne serait plus celui sur lequel les filtres comparent.
   */
  it('reste en UTC quel que soit le fuseau de la machine', () => {
    // Minuit UTC : c'est la veille au soir sur tout le continent américain.
    expect(formatDay('2026-08-03T00:00:00Z', 'fr')).toBe('03/08/2026')
  })

  // Largeur fixe dans les deux langues : la colonne des dates est alignée en
  // `tabular-nums`, et un `8/3/26` la ferait respirer d'une ligne à l'autre.
  it('donne la même largeur dans les deux langues', () => {
    expect(formatDay('2026-08-03', 'en')).toHaveLength(formatDay('2026-08-03', 'fr').length)
  })
})
