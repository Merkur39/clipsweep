import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The gate on the mark, which three files draw and none of them can check.
 *
 * `Icon.tsx` is the authority; `public/favicon.svg` restates it to stand alone
 * in a document CSS variables never reach; `scripts/make-favicon.ts` restates it
 * again as numbers, to rasterise a PNG for the browsers that read no SVG. A
 * touch-up in one of the three used to leave the other two quietly wrong — the
 * PNG worst of all, since nobody would know it needed redoing.
 *
 * It parses rather than restates, like `scripts/contrast` and the tile geometry:
 * a shape it cannot find is a failure, never a pass.
 *
 * The tail is the one thing it does not compare, and deliberately: the interface
 * draws four dashes, the two icons a short bar, because at the size of a tab the
 * gaps between those dashes fall under half a pixel. What the gate holds is that
 * each of the three draws three bars and exactly one tail.
 */
const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const icon = source('../../src/components/Icon.tsx')
const svg = source('../../public/favicon.svg')
const script = source('../../scripts/make-favicon.ts')

interface Bar {
  x: number
  y: number
  width: number
  height: number
  opacity: number
}

const attribute = (tag: string, name: string): number | null => {
  const found = new RegExp(`\\b${name}=["']([\\d.]+)["']`).exec(tag)
  return found ? Number(found[1]) : null
}

const rectsIn = (markup: string): string[] => markup.match(/<rect\b[^>]*\/>/g) ?? []

const asBar = (tag: string, where: string): Bar => {
  const of = (name: string) => {
    const value = attribute(tag, name)
    if (value === null) throw new Error(`no "${name}" on a rect of ${where}`)
    return value
  }
  return {
    x: of('x'),
    y: of('y'),
    width: of('width'),
    height: of('height'),
    opacity: attribute(tag, 'opacity') ?? 1,
  }
}

/** The body of `Mark`, so no other glyph of the sheet is read by mistake. */
const mark = (() => {
  const found = /export function Mark\(\)[\s\S]*?\n}/.exec(icon)
  if (!found) throw new Error('no Mark function in Icon.tsx')
  return found[0]
})()

/** The rows of the `RECTS` literal: fill, alpha, x, y, width, height. */
const scriptRects = (() => {
  const literal = /const RECTS: readonly Rect\[\] = \[([\s\S]*?)\n\]/.exec(script)
  if (!literal) throw new Error('no RECTS literal in make-favicon.ts')

  const rows = [...literal[1].matchAll(/\['(#[0-9a-f]{6})',\s*([\d.]+),([^\]]*)\]/g)]
  if (rows.length === 0) throw new Error('no rectangle in the RECTS literal')

  return rows.map(([, fill, alpha, rest]) => {
    const [x, y, width, height] = rest.split(',').map((value) => Number(value.trim()))
    return { fill, bar: { x, y, width, height, opacity: Number(alpha) } }
  })
})()

const number = (text: string, pattern: RegExp, where: string): number => {
  const found = pattern.exec(text)
  if (!found) throw new Error(`${where} declares no ${pattern}`)
  return Number(found[1])
}

describe('the mark, across the three files that draw it', () => {
  it('draws three bars and one tail everywhere', () => {
    expect(rectsIn(mark)).toHaveLength(3)
    expect(/<path\b/.test(mark)).toBe(true)
    expect(rectsIn(svg)).toHaveLength(4)
    expect(scriptRects).toHaveLength(4)
  })

  it('agrees on the bars, to the last tenth', () => {
    const bars = rectsIn(mark).map((tag) => asBar(tag, 'Icon.tsx'))

    expect(
      rectsIn(svg)
        .slice(0, 3)
        .map((tag) => asBar(tag, 'favicon.svg')),
    ).toEqual(bars)
    expect(scriptRects.slice(0, 3).map((rect) => rect.bar)).toEqual(bars)
  })

  it('agrees on the frame the bars are placed in', () => {
    const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(mark)
    if (!box) throw new Error('no viewBox on Mark')

    expect(svg).toContain(`viewBox="0 0 ${box[1]} ${box[2]}"`)
    expect(number(script, /VIEW_WIDTH = ([\d.]+)/, 'make-favicon.ts')).toBe(Number(box[1]))
    expect(number(script, /VIEW_HEIGHT = ([\d.]+)/, 'make-favicon.ts')).toBe(Number(box[2]))
  })

  // The one figure the raster cannot read off a rect: it rounds every corner by
  // the same radius, and a mark whose corners had moved would go unnoticed.
  it('agrees on the radius of the corners', () => {
    const radius = attribute(rectsIn(mark)[0], 'rx')

    expect(attribute(rectsIn(svg)[0], 'rx')).toBe(radius)
    expect(number(script, /const RADIUS = ([\d.]+)/, 'make-favicon.ts')).toBe(radius)
  })

  it('fails on a shape it cannot find rather than passing', () => {
    expect(() => asBar('<rect y="1" />', 'nowhere')).toThrow(/no "x"/)
  })
})
