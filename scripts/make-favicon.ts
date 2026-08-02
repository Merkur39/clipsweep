/**
 * Rastérise la marque en `public/favicon.png`, le repli des navigateurs qui ne
 * lisent pas les favicons SVG — Safari au premier chef.
 *
 *     npm run favicon
 *
 * Trois fichiers portent la marque : `src/components/Icon.tsx` (`Mark`), qui
 * fait foi, `public/favicon.svg`, et ce PNG. Les deux premiers s'éditent à la
 * main ; celui-ci se régénère, d'où ce script — sans lui, une retouche du
 * `Mark` laisserait un PNG périmé que personne ne saurait refaire.
 *
 * Pas de dépendance de conversion : un encodeur PNG tient en quelques dizaines
 * de lignes avec le `zlib` de Node, là où `sharp` ou `resvg` pèseraient des
 * dizaines de mégaoctets dans `devDependencies` pour produire 272 octets.
 *
 * Node exécute ce `.ts` directement, par effacement des types — d'où
 * `erasableSyntaxOnly` dans `tsconfig.node.json`, qui interdit la syntaxe que
 * l'effacement ne saurait pas rendre (`enum`, `namespace`, propriétés de
 * constructeur). Sans ce garde-fou, une telle syntaxe passerait le typecheck et
 * casserait à l'exécution.
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

/** Un rectangle de la marque, dans le repère du `viewBox`. */
type Rect = readonly [fill: string, x: number, y: number, width: number, height: number]

/**
 * Les rectangles de `Mark`, dans la **variante claire** de `base.css`.
 *
 * Un PNG ne suit pas le thème de l'onglet : il faut trancher. Le beige de la
 * première barre reste lisible sur un onglet sombre, alors que le `#39415c` de
 * la variante sombre disparaîtrait sur un onglet clair — le choix n'est donc
 * pas symétrique.
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

/** `rx` des rects, et côté du `viewBox` : les deux viennent de `Mark`. */
const RADIUS = 0.6
const VIEW = 16

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/**
 * Un point tombe-t-il dans un rect à coins arrondis ? Le point est ramené sur
 * le rectangle intérieur (celui que les arrondis n'entament pas), et c'est la
 * distance à ce point-là qui décide.
 */
function inside(px: number, py: number, [, x, y, width, height]: Rect): boolean {
  const cx = Math.min(Math.max(px, x + RADIUS), x + width - RADIUS)
  const cy = Math.min(Math.max(py, y + RADIUS), y + height - RADIUS)
  return (px - cx) ** 2 + (py - cy) ** 2 <= RADIUS * RADIUS
}

/**
 * Un pixel par échantillonnage d'une grille `samples × samples` : la couverture
 * donne l'alpha, la moyenne des touches donne la couleur. C'est l'anti-aliasing
 * du pauvre, et il suffit — à 32px les bords sont courts et les aplats francs.
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

/** Un chunk PNG : longueur, type, données, CRC du type et des données. */
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
  ihdr[8] = 8 // profondeur, bits par canal
  ihdr[9] = 6 // type couleur : RGBA

  // Chaque scanline est précédée de son octet de filtre, ici toujours 0 : le
  // motif est fait d'aplats, un filtre adaptatif ne gagnerait rien sur 32px.
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

// 32px et non 16 : c'est ce qu'affiche un onglet sur un écran à densité double,
// et un navigateur réduit mieux qu'il n'agrandit.
const size = Number(process.argv[2] ?? 32)
const target = new URL('../public/favicon.png', import.meta.url)

writeFileSync(target, png(size))
console.log(`public/favicon.png — ${size}×${size}`)
