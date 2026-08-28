/**
 * Rasterises the mark into `public/favicon.png`, the fallback for browsers that
 * do not read SVG favicons — Safari first among them.
 *
 *     npm run favicon
 *
 * Three files carry the mark: `src/components/Icon.tsx` (`Mark`), which is
 * authoritative, `public/favicon.svg`, and this PNG. The first two are edited by
 * hand; this one is regenerated, hence this script — without it, a touch-up of
 * the `Mark` would leave a stale PNG that nobody would know how to redo.
 *
 * No conversion dependency: a PNG encoder fits in a few dozen lines with Node's
 * `zlib`, where `sharp` or `resvg` would weigh tens of megabytes in
 * `devDependencies` to produce 272 bytes.
 *
 * Node runs this `.ts` directly, by erasing the types — hence
 * `erasableSyntaxOnly` in `tsconfig.node.json`, which forbids the syntax that
 * erasure would not know how to render (`enum`, `namespace`, constructor
 * properties). Without that guard, such syntax would pass the typecheck and
 * break at run time.
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

/** One rectangle of the mark, in the frame of the `viewBox`. */
type Rect = readonly [
  fill: string,
  alpha: number,
  x: number,
  y: number,
  width: number,
  height: number,
]

/**
 * The rectangles of `Mark`, in the **light variant** of `base.css`.
 *
 * A PNG does not follow the tab's theme: a side has to be taken. The darker
 * mint holds against a dark tab, where the `#47d7b8` of the dark variant would
 * all but vanish against a light one — the choice is not symmetric.
 *
 * The tail is one short bar and not the four dashes the interface draws: at the
 * size of a tab the gaps between those dashes fall under half a pixel, and four
 * of them read as a smear. Same divergence as `favicon.svg`, same reason.
 */
const RECTS: readonly Rect[] = [
  ['#00957d', 1, 2.5, 3.4, 23, 2.9],
  ['#00957d', 0.72, 2.5, 9.2, 17, 2.9],
  ['#00957d', 0.46, 2.5, 15, 10.5, 2.9],
  ['#65686f', 1, 2.5, 20.5, 5, 2.9],
]

/** The `rx` of the rects, and the `viewBox` they live in: both come from `Mark`. */
const RADIUS = 1.45
const VIEW_WIDTH = 28
const VIEW_HEIGHT = 24
/**
 * The square the PNG has to be, in the units of the `viewBox`. A mark that is
 * not square is letterboxed by an SVG renderer, and the raster has to letterbox
 * it the same way or the two icons would not be the same drawing.
 */
const VIEW = Math.max(VIEW_WIDTH, VIEW_HEIGHT)
const INSET_X = (VIEW - VIEW_WIDTH) / 2
const INSET_Y = (VIEW - VIEW_HEIGHT) / 2

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/**
 * Does a point fall inside a rect with rounded corners? The point is brought
 * back onto the inner rectangle (the one the roundings do not bite into), and
 * it is the distance to that point which decides.
 */
function inside(px: number, py: number, [, , x, y, width, height]: Rect): boolean {
  const cx = Math.min(Math.max(px, x + RADIUS), x + width - RADIUS)
  const cy = Math.min(Math.max(py, y + RADIUS), y + height - RADIUS)
  return (px - cx) ** 2 + (py - cy) ** 2 <= RADIUS * RADIUS
}

/**
 * One pixel by sampling a `samples × samples` grid: the coverage gives the
 * alpha, the average of the hits gives the colour. It is the poor man's
 * anti-aliasing, and it is enough — at 32px the edges are short and the flats
 * are clean.
 *
 * A rect's own alpha is weighed into the coverage rather than blended into its
 * colour: the mark stands on nothing, so a bar drawn at 72% is 72% opaque, not
 * a paler mint.
 */
function render(size: number, samples = 8): Buffer {
  const pixels = Buffer.alloc(size * size * 4)
  const step = VIEW / size / samples

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      let hits = 0
      let covered = 0
      let r = 0
      let g = 0
      let b = 0

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (col * VIEW) / size + (sx + 0.5) * step - INSET_X
          const y = (row * VIEW) / size + (sy + 0.5) * step - INSET_Y
          const hit = RECTS.find((rect) => inside(x, y, rect))
          if (!hit) continue

          const [hr, hg, hb] = rgb(hit[0])
          r += hr
          g += hg
          b += hb
          covered += hit[1]
          hits++
        }
      }

      if (hits === 0) continue
      const i = (row * size + col) * 4
      pixels[i] = Math.round(r / hits)
      pixels[i + 1] = Math.round(g / hits)
      pixels[i + 2] = Math.round(b / hits)
      pixels[i + 3] = Math.round((covered / (samples * samples)) * 255)
    }
  }

  return pixels
}

const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer: Buffer): number {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A PNG chunk: length, type, data, CRC of the type and the data. */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size: number): Buffer {
  const pixels = render(size)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // depth, bits per channel
  ihdr[9] = 6 // colour type: RGBA

  // Each scanline is preceded by its filter byte, here always 0: the pattern is
  // made of flats, an adaptive filter would gain nothing at 32px.
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let row = 0; row < size; row++) {
    pixels.copy(raw, row * stride + 1, row * size * 4, (row + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 32px and not 16: that is what a tab shows on a double-density screen, and a
// browser scales down better than it scales up.
const size = Number(process.argv[2] ?? 32)
const target = new URL('../public/favicon.png', import.meta.url)

writeFileSync(target, png(size))
console.log(`public/favicon.png — ${size}×${size}`)
