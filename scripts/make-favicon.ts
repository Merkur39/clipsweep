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
type Rect = readonly [fill: string, x: number, y: number, width: number, height: number]

/**
 * The rectangles of `Mark`, in the **light variant** of `base.css`.
 *
 * A PNG does not follow the tab's theme: a side has to be taken. The beige of
 * the first bar stays readable on a dark tab, whereas the `#39415c` of the dark
 * variant would disappear on a light tab — the choice is therefore not
 * symmetric.
 */
const RECTS: readonly Rect[] = [
  ['#b6ada0', 1, 2.4, 14, 2.2],
  ['#b6ada0', 1, 6.9, 6.4, 2.2],
  ['#8f6ae8', 8.6, 6.9, 6.4, 2.2],
  ['#8f6ae8', 1, 11.4, 2.8, 2.2],
  ['#6b3fd4', 5, 11.4, 2.4, 2.2],
  ['#6b3fd4', 8.6, 11.4, 2.4, 2.2],
  ['#cf2b2b', 12.2, 11.4, 2.8, 2.2],
]

/** The `rx` of the rects, and the side of the `viewBox`: both come from `Mark`. */
const RADIUS = 0.6
const VIEW = 16

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
function inside(px: number, py: number, [, x, y, width, height]: Rect): boolean {
  const cx = Math.min(Math.max(px, x + RADIUS), x + width - RADIUS)
  const cy = Math.min(Math.max(py, y + RADIUS), y + height - RADIUS)
  return (px - cx) ** 2 + (py - cy) ** 2 <= RADIUS * RADIUS
}

/**
 * One pixel by sampling a `samples × samples` grid: the coverage gives the
 * alpha, the average of the hits gives the colour. It is the poor man's
 * anti-aliasing, and it is enough — at 32px the edges are short and the flats
 * are clean.
 */
function render(size: number, samples = 8): Buffer {
  const pixels = Buffer.alloc(size * size * 4)
  const step = VIEW / size / samples

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      let hits = 0
      let r = 0
      let g = 0
      let b = 0

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (col * VIEW) / size + (sx + 0.5) * step
          const y = (row * VIEW) / size + (sy + 0.5) * step
          const hit = RECTS.find((rect) => inside(x, y, rect))
          if (!hit) continue

          const [hr, hg, hb] = rgb(hit[0])
          r += hr
          g += hg
          b += hb
          hits++
        }
      }

      if (hits === 0) continue
      const i = (row * size + col) * 4
      pixels[i] = Math.round(r / hits)
      pixels[i + 1] = Math.round(g / hits)
      pixels[i + 2] = Math.round(b / hits)
      pixels[i + 3] = Math.round((hits / (samples * samples)) * 255)
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
