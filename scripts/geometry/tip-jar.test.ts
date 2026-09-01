import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The gate on the probe, a contract two files hold and no cascade enforces.
 *
 * The Ko-fi button lives inside a frame the widget writes, where none of the
 * page's tokens reach: `src/styles/tip-jar.css` resolves the page's own control
 * on one hidden element, and `readSkin` in `src/components/tipJarFrame.ts`
 * reads it back off that element to write it into the frame. Neither half can
 * see the other. Four of the six properties do not inherit, so a declaration
 * that slips one element up comes back as an empty flat and three borders in
 * `currentColor` — a transparent button wearing a border the colour of its own
 * label, on a page that typechecks and passes every test. That is the shape
 * this caught, once, from a browser.
 *
 * It parses rather than restates, like `scripts/contrast` and the tile
 * geometry, and for the same reason: a rule it cannot find is a failure, never
 * a pass.
 */
const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const css = source('../../src/styles/tip-jar.css')
const frame = source('../../src/components/tipJarFrame.ts')

/** What `readSkin` asks the computed style for, in the order it asks. */
const read = (() => {
  const body = /function readSkin[\s\S]*?\n\}/.exec(frame)
  if (!body) throw new Error('no readSkin in tipJarFrame.ts')

  const properties = [...body[0].matchAll(/resolved\.(\w+)/g)].map(([, name]) => name)
  if (properties.length === 0) throw new Error('readSkin reads nothing off the computed style')
  return properties
})()

/** What the sheet declares on the probe, by the name the CSSOM answers to. */
const declared = (() => {
  const rule = /\.tip-jar-skin\s*\{([^}]*)\}/.exec(css)
  if (!rule) throw new Error('no .tip-jar-skin rule in tip-jar.css')

  const values = new Map<string, string>()
  for (const [, property, value] of rule[1].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    values.set(
      property.replaceAll(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
      value.trim(),
    )
  }
  return values
})()

describe('the tip jar probe', () => {
  it('declares, on the probe itself, everything the frame reads off it', () => {
    for (const property of read) {
      expect(declared.get(property), property).toBeDefined()
    }
  })

  // The sheet is the palette's single source, as it is everywhere else here: a
  // colour spelled out on the probe is a colour that no longer follows a theme.
  it('names a token for each of them rather than a colour', () => {
    for (const property of read) {
      expect(declared.get(property), property).toMatch(/^var\(--/)
    }
  })

  // Painted, it would be a rectangle of `--surface-raised` at the foot of the
  // page. Hidden, its colours are computed all the same, which is the point.
  it('keeps the probe off the page', () => {
    expect(declared.get('display')).toBe('none')
  })
})
