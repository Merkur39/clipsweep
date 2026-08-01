import { describe, expect, it } from 'vitest'

import { formatCount } from './numbers'

/** Insécable ordinaire, le seul séparateur que `formatCount` doit produire. */
const NBSP = String.fromCharCode(0x00a0)
/** Espace fine insécable, celle qu'`Intl` produit pour fr-FR. */
const NARROW_NBSP = String.fromCharCode(0x202f)
/** Espace fine. */
const THIN = String.fromCharCode(0x2009)

describe('formatCount', () => {
  it('laisse les petits nombres intacts', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })

  it('groupe les milliers', () => {
    expect(formatCount(1000)).toBe(`1${NBSP}000`)
    expect(formatCount(20000)).toBe(`20${NBSP}000`)
  })

  it('groupe chaque tranche', () => {
    expect(formatCount(1234567)).toBe(`1${NBSP}234${NBSP}567`)
  })

  // Plusieurs polices monospace n'ont pas l'espace fine : elle se replie sur un
  // glyphe de largeur différente et désaligne la colonne des vues, que
  // `tabular-nums` venait justement de rendre comparable.
  it('n’emploie ni espace fine, ni espace sécable', () => {
    const groupé = formatCount(1234567)

    expect(groupé).not.toContain(NARROW_NBSP)
    expect(groupé).not.toContain(THIN)
    expect(groupé).not.toContain(' ')
  })
})
