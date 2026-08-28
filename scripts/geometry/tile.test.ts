import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The gate on the one contract this codebase keeps in two places on purpose.
 *
 * A tile's `metaHeight` is a number in `src/components/tileGeometry.ts`, because
 * the virtualiser multiplies it to place rows; the block it measures is drawn by
 * `src/styles/clip-grid.css`, because a sheet is what draws type. Nothing at
 * runtime compares the two — jsdom has no layout, and a browser has to be
 * scrolled several rows down before the drift is visible at all — so this reads
 * both sources and does the addition.
 *
 * It **parses rather than restates**, the same stance as `scripts/contrast`, and
 * for the same reason: a rule it cannot find has to be a failure, never a pass.
 * A silently inert check is indistinguishable from a green one. That is also why
 * it reads the TypeScript as text instead of importing it — `scripts/` and
 * `src/` are two TypeScript projects, and the file that checks the shipped
 * source should in any case be reading the shipped source.
 */
const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const css = source('../../src/styles/clip-grid.css')
const geometry = source('../../src/components/tileGeometry.ts')
const view = source('../../src/domain/view.ts')

/** The `metaHeight` of each density, read off the literal the component ships. */
const declared = (() => {
  const literal = /TILE_GEOMETRY[^=]*=\s*\{([\s\S]*?)\n\}/.exec(geometry)
  if (!literal) throw new Error('no TILE_GEOMETRY literal in tileGeometry.ts')

  const heights = new Map<string, number>()
  for (const [, name, height] of literal[1].matchAll(/(\w+):\s*\{[^}]*metaHeight:\s*(\d+)/g)) {
    heights.set(name, Number(height))
  }
  if (heights.size === 0) throw new Error('no density in TILE_GEOMETRY carries a metaHeight')
  return heights
})()

/** The densities the application offers, which both other files must cover. */
const densities = (() => {
  const literal = /TILE_VIEWS\s*=\s*\[([^\]]*)\]/.exec(view)
  if (!literal) throw new Error('no TILE_VIEWS literal in view.ts')
  return [...literal[1].matchAll(/'([^']+)'/g)].map(([, name]) => name)
})()

const block = (selector: string): string => {
  const escaped = selector.replace(/[.[\]*+?^${}()|\\]/g, '\\$&')
  const found = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css)
  if (!found) throw new Error(`clip-grid.css declares no rule for "${selector}"`)
  return found[1]
}

const px = (declarations: string, property: string, selector: string): number => {
  const found = new RegExp(`(?:^|;)\\s*${property}:\\s*(-?[\\d.]+)px`, 'm').exec(declarations)
  if (!found) throw new Error(`"${property}" is not declared in px on "${selector}"`)
  return Number(found[1])
}

/**
 * `margin: <top> <sides> <bottom>`, the only shorthand this sheet writes. The
 * side value is read past rather than measured — the tile has no inset left to
 * give since it lost its frame, so it is a bare `0`, unit and all.
 */
const margin = (declarations: string, selector: string): { top: number; bottom: number } => {
  const found = /(?:^|;)\s*margin:\s*(-?[\d.]+)(?:px)?\s+[\d.]+(?:px)?\s+(-?[\d.]+)(?:px)?/m.exec(
    declarations,
  )
  if (!found) throw new Error(`no three-value margin on "${selector}"`)
  return { top: Number(found[1]), bottom: Number(found[2]) }
}

const lineClamp = (declarations: string, selector: string): number => {
  const found = /-webkit-line-clamp:\s*(\d+)/.exec(declarations)
  if (!found) throw new Error(`no -webkit-line-clamp on "${selector}"`)
  return Number(found[1])
}

describe('the tile block, drawn against the height the virtualiser places', () => {
  // A density added to the toggle and forgotten in the geometry draws nothing at
  // all under the thumbnail; one forgotten in the sheet draws the wrong thing.
  it('covers every density the application offers', () => {
    expect([...declared.keys()].sort()).toEqual([...densities].sort())
  })

  /**
   * The addition below counts the air and the two lines, and nothing else. A
   * border put back on the tile would add two pixels to every row that the
   * placed rows know nothing about — the drift this whole file exists to catch,
   * arriving through the one term it stopped counting.
   */
  it('leaves the tile without a frame for the addition to miss', () => {
    expect(block('.tile')).not.toMatch(/(?:^|;)\s*border(?:-\w+)?:/m)
  })

  for (const density of densities) {
    const titleAt = `.grid[data-density='${density}'] .tile-title`
    const metaAt = `.grid[data-density='${density}'] .tile-meta`

    it(`adds up to the metaHeight of "${density}"`, () => {
      const title = block(titleAt)
      const meta = block(metaAt)
      const drawn =
        margin(title, titleAt).top +
        px(title, 'height', titleAt) +
        margin(title, titleAt).bottom +
        margin(meta, metaAt).top +
        px(meta, 'height', metaAt) +
        margin(meta, metaAt).bottom

      expect(drawn).toBe(declared.get(density))
    })

    // The other way the same block goes wrong in silence: a title clamped to two
    // lines inside the height of one is cut across a letter, and the addition
    // above still balances.
    it(`reserves in "${density}" exactly the lines it clamps to`, () => {
      const title = block(titleAt)

      expect(px(title, 'height', titleAt)).toBe(
        lineClamp(title, titleAt) * px(title, 'line-height', titleAt),
      )
    })
  }

  // The gate is worth what its parser is worth: a rule it cannot find has to be
  // a failure, or a renamed selector would leave every check above quietly
  // inert.
  it('fails on a rule it cannot find rather than passing', () => {
    expect(() => block('.tile-nothing')).toThrow(/no rule/)
  })
})
