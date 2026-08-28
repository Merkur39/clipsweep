/**
 * The colour arithmetic the contrast gate rests on.
 *
 * Deliberately small: the gate *verifies* a palette, it does not derive one.
 * Deriving is a design act, done once with its own reasoning; checking is what
 * has to run on every commit, and it needs nothing but a ratio.
 */

export type Rgb = readonly [number, number, number]

const HEX = /^#?(?:([\da-f]{3})|([\da-f]{6}))$/i

/** A colour channel, sRGB-encoded 0–255, back to its linear-light value. */
const linearize = (channel: number) => {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function parseHex(value: string): Rgb {
  const match = HEX.exec(value.trim())
  if (!match) throw new Error(`Not a hex colour: ${value}`)

  const [, short, long] = match
  const digits = short ? [...short].map((d) => d + d).join('') : long
  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
  ] as const
}

/** WCAG relative luminance. The weights are the sRGB ones, not a mean. */
const luminance = ([r, g, b]: Rgb) =>
  0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)

/**
 * WCAG 2 contrast ratio, 1 to 21. Symmetric: which colour is the ink and
 * which is the ground changes nothing, so callers never have to remember an
 * argument order.
 */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(parseHex(a))
  const second = luminance(parseHex(b))
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
