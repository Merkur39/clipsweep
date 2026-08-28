import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { checkPalette, describeFinding, type Rules } from './gate.ts'
import { readPalettes, type Palette } from './tokens.ts'

/**
 * The gate, on the palette the application actually ships.
 *
 * It reads `base.css` rather than restating it, so the two cannot drift; and
 * it runs under `npm test`, so a token cannot be lowered in a hurry without
 * the run going red.
 */
const css = readFileSync(
  fileURLToPath(new URL('../../src/styles/base.css', import.meta.url)),
  'utf8',
)
const { light, dark } = readPalettes(css)

/**
 * Every surface a piece of text can land on — the hovered row included,
 * because that is the lightest surface of the dark world and therefore the
 * one that decides how pale the faintest ink is allowed to be.
 *
 * `--surface-sunken` is deliberately absent: nothing writes on it. It is the
 * ground of a pressed button, whose own colour is `--text`, and the fill
 * behind a missing thumbnail, where the only mark is a decorative glyph at
 * 0.4 opacity. Listing it produced four findings on pairings that never reach
 * a screen — measuring an ink against a surface it never touches invents
 * failures as surely as measuring it against the bare page hides them.
 *
 * ⚠️ This list is a claim about the components, and no parser checks it. A
 * component that starts putting text on a new surface has to add it here;
 * the browser pass over the rendered application is what would catch the
 * omission, and it does not run in CI.
 */
const SURFACES = ['ground', 'chassis', 'surface', 'surface-raised', 'surface-hover']

/**
 * The roles are read off the components, not assumed from the token names.
 *
 * `--warn-ink` writes: it is the colour of a zero view count, the case the
 * search exists to unearth, and it lands inside a table row that lightens on
 * hover. `--danger-mark` never writes — all three of its uses sit on an
 * `.icon`, and the accompanying sentence is always `--danger-ink`. Held to
 * 4.5 it reported a failure on a pairing that only ever carries a glyph.
 */
const rules: Rules = {
  surfaces: SURFACES,
  inks: ['text', 'text-dim', 'text-faint', 'accent-ink', 'accent-strong', 'warn-ink', 'danger-ink'],
  marks: ['rule-control', 'accent-mark', 'warn-mark', 'danger-mark'],
  flats: [
    { flat: 'accent', label: 'on-accent' },
    // Pressed takes the resting label: with a mint flat the two worlds
    // fall the same way round, so there is nothing left for a second token
    // to say.
    { flat: 'accent-press', label: 'on-accent' },
  ],
}

const report = (palette: Palette) => checkPalette(palette, rules).map(describeFinding)

describe('the shipped palette', () => {
  it('names tokens that all exist — a renamed token silently disables its check', () => {
    const named = new Set([...rules.surfaces, ...rules.inks, ...rules.flats.map((f) => f.flat)])
    expect([...named].filter((t) => !dark.has(t))).toEqual([])
  })

  it('keeps every ink legible on every surface, in the dark world', () => {
    expect(report(dark)).toEqual([])
  })

  it('keeps every ink legible on every surface, in the light world', () => {
    expect(report(light)).toEqual([])
  })
})
