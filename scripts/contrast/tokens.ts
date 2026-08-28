/**
 * Reads the two worlds out of the stylesheet itself.
 *
 * The alternative — restating the palette in TypeScript — would make the
 * colours a contract held in two places, and this repository has already paid
 * for one of those: a geometry constant duplicated between a module and a
 * sheet, where touching one without the other broke the layout silently.
 * Here the sheet stays the single source, and the gate reads it.
 */

export type Palette = Map<string, string>

/** `--name: light-dark(#aaa, #bbb);` — the form the whole sheet uses. */
const LIGHT_DARK = /--([\w-]+)\s*:\s*light-dark\(\s*(#[\da-f]{3,8})\s*,\s*(#[\da-f]{3,8})\s*\)/gi

/** `--name: #aaa;` — a colour that is the same in both worlds. */
const FLAT = /--([\w-]+)\s*:\s*(#[\da-f]{3,8})\s*[;}]/gi

export function readPalettes(css: string): { light: Palette; dark: Palette } {
  const light: Palette = new Map()
  const dark: Palette = new Map()

  // Flats first, so a later `light-dark()` for the same name wins — matching
  // the cascade, where the last declaration is the one that applies.
  for (const [, name, hex] of css.matchAll(FLAT)) {
    light.set(name, hex.toLowerCase())
    dark.set(name, hex.toLowerCase())
  }
  for (const [, name, lightHex, darkHex] of css.matchAll(LIGHT_DARK)) {
    light.set(name, lightHex.toLowerCase())
    dark.set(name, darkHex.toLowerCase())
  }

  return { light, dark }
}
