/**
 * The whole icon vocabulary, drawn on one 24-unit grid with one stroke weight.
 *
 * Unicode glyphs (▲ ▾ ×) render at whatever weight and baseline the visitor's
 * font stack happens to carry, which is not a decision anyone made — so none
 * appears here or in any string.
 *
 * Every glyph is decoration: the control next to it carries the name. Hiding
 * them all at the source is the only way that stays true as glyphs are added.
 * A name that is not in the table renders nothing at all and raises no error,
 * which is why the union type is the table's own keys.
 */

const PATHS = {
  sun: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  out: 'M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5M16 17l5-5-5-5M21 12H9',
  radar: 'M12 3a9 9 0 1 0 9 9M12 8a4 4 0 1 0 4 4M12 12 21 4',
  chevron: 'm5 9 7 7 7-7',
  x: 'M5 5l14 14M19 5 5 19',
  down: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  check: 'm4 12.5 5 5L20 6.5',
  rows: 'M4 6h16M4 12h16M4 18h16',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10',
  left: 'M19 12H5M11 6l-6 6 6 6',
  right: 'M5 12h14M13 6l6 6-6 6',
  bookmark: 'M6 3.5h12a1 1 0 0 1 1 1v16l-7-4-7 4v-16a1 1 0 0 1 1-1z',
  rotate: 'M3.5 12a8.5 8.5 0 1 1 2.8 6.3M3.5 19v-5h5',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  search: 'm16.5 16.5 4.5 4.5',
} as const

/** Glyphs the single-path table cannot express: circles, rectangles, fills. */
const SHAPES: Partial<Record<IconName, React.ReactNode>> = {
  sun: <circle cx="12" cy="12" r="4" />,
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </>
  ),
  /* The one solid glyph of the set, and it has to be: a triangle drawn as an
     outline at this size reads as a caret, which already means "sort" here. */
  play: <path d="M6.5 4.8v14.4l12-7.2z" fill="currentColor" stroke="none" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M17 5.2a3.5 3.5 0 0 1 0 5.6M18.5 20a6.4 6.4 0 0 0-2.2-4.8" />
    </>
  ),
  gamepad: (
    <>
      <rect x="2.5" y="7" width="19" height="10.5" rx="4" />
      <path d="M7 10.5v3M5.5 12h3M15.5 11.4v.1M18 13.4v.1" />
    </>
  ),
  eye: <circle cx="12" cy="12" r="2.75" />,
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </>
  ),
  search: <circle cx="11" cy="11" r="7" />,
}

export type IconName =
  | keyof typeof PATHS
  | 'monitor'
  | 'play'
  | 'stop'
  | 'grid'
  | 'cal'
  | 'users'
  | 'gamepad'
  | 'sliders'

/**
 * The side a glyph is drawn at when nobody says otherwise.
 *
 * There has to be one. An `<svg>` carrying only a `viewBox` resolves to 100% of
 * its containing block, so a glyph the sheet forgot to size does not come out
 * slightly wrong — it fills the button. The attribute is the floor and the sheet
 * still wins over it, a rule on `.box svg` or `.cta svg` beating a presentational
 * attribute in the cascade; what this buys is that the failure mode of a missing
 * rule is a glyph one pixel off its family, not a page-high calendar.
 */
const GLYPH = 15

interface IconProps {
  name: IconName
  /** Drawn side in pixels, when neither the default nor the sheet is right. */
  size?: number
  /** Rotation in degrees, for the chevron that points four ways. */
  turn?: number
}

export function Icon({ name, size = GLYPH, turn }: IconProps) {
  const path = PATHS[name as keyof typeof PATHS]

  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={turn ? { transform: `rotate(${turn}deg)` } : undefined}
    >
      {path && <path d={path} />}
      {SHAPES[name]}
    </svg>
  )
}

/**
 * The brand mark: three bars of a growing sweep in a rounded flat. Drawn in
 * elements rather than SVG because the design system draws it that way — the
 * bars take `--on-accent` and the plate takes `--accent`, so it follows the
 * accent's three roles instead of freezing a hex.
 */
export function Mark({ small = false }: { small?: boolean } = {}) {
  return (
    <span className={small ? 'mark sm' : 'mark'} aria-hidden="true">
      <s />
      <s />
      <s />
    </span>
  )
}
