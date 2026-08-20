/**
 * The whole icon vocabulary, drawn on one 16-unit grid with one stroke weight.
 * Unicode glyphs (▲ ▾ ×) render at whatever weight and baseline the visitor's
 * font stack happens to carry, which is not a decision anyone made.
 */

interface IconProps {
  /** Rotation in degrees, for the carets that point four ways. */
  turn?: number
  /** Drawn side, in pixels. The default is the size the glyph was drawn for. */
  size?: number
}

const base = {
  className: 'icon',
  width: 12,
  height: 12,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function CaretIcon({ turn = 0 }: IconProps) {
  return (
    <svg
      {...base}
      width={9}
      height={9}
      style={turn ? { transform: `rotate(${turn}deg)` } : undefined}
    >
      <path d="M3 10.5 8 5.5l5 5" />
    </svg>
  )
}

export function ChevronIcon({ turn = 0 }: IconProps) {
  return (
    <svg {...base} style={turn ? { transform: `rotate(${turn}deg)` } : undefined}>
      <path d="M4 6.5 8 10.5l4-4" />
    </svg>
  )
}

/** 11 px in the fields it clears; the player asks for a bigger one. */
export function CloseIcon({ size = 11 }: IconProps = {}) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

/**
 * The one solid glyph of the set, and it has to be: a triangle drawn as an
 * outline at this size reads as a caret, which already means "sort" here.
 */
export function PlayIcon() {
  return (
    <svg {...base} width={13} height={13} fill="currentColor" stroke="none">
      <path d="M4.6 3.1 12.4 8l-7.8 4.9Z" />
    </svg>
  )
}

/** Drawn at the head of the field it belongs to, never as a button. */
export function SearchIcon() {
  return (
    <svg {...base} width={15} height={15} strokeWidth={1.7}>
      <circle cx="7.2" cy="7.2" r="4.6" />
      <path d="M10.6 10.6 14 14" />
    </svg>
  )
}

/** Down, into the machine: the arrow lands on a floor, which is the file. */
export function DownloadIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M8 2.5v7.5M5 7.5 8 10.5l3-3M3 13.5h10" />
    </svg>
  )
}

/** An arrow leaving the panel: you are leaving, nothing is being deleted. */
export function LogoutIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M9 2.5H3.5v11H9" />
      <path d="M7.5 8H14M11.5 5.5 14 8l-2.5 2.5" />
    </svg>
  )
}

/* ---- the two readouts ----
   Each glyph is its own layout seen from above: lines that run the width, or
   cells that tile it. Nothing here names a clip — what is being chosen is a
   shape, not a content. */

export function RowsIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  )
}

/* The two galleries. Filled, where every other glyph is stroked: a
   three-column grid drawn at this weight leaves cells of four units carrying
   two of stroke, and turns to mush at the size the control is read at. Solid
   cells keep the pair legible and, more to the point, keep them comparable —
   they say the same thing at two densities, so they must be drawn the same
   way. */

export function GridIcon() {
  return (
    <svg {...base} width={13} height={13} fill="currentColor" stroke="none">
      <rect x="0.8" y="0.8" width="6.4" height="6.4" />
      <rect x="8.8" y="0.8" width="6.4" height="6.4" />
      <rect x="0.8" y="8.8" width="6.4" height="6.4" />
      <rect x="8.8" y="8.8" width="6.4" height="6.4" />
    </svg>
  )
}

export function DenseGridIcon() {
  return (
    <svg {...base} width={13} height={13} fill="currentColor" stroke="none">
      <rect x="0.8" y="0.8" width="4" height="4" />
      <rect x="6" y="0.8" width="4" height="4" />
      <rect x="11.2" y="0.8" width="4" height="4" />
      <rect x="0.8" y="6" width="4" height="4" />
      <rect x="6" y="6" width="4" height="4" />
      <rect x="11.2" y="6" width="4" height="4" />
      <rect x="0.8" y="11.2" width="4" height="4" />
      <rect x="6" y="11.2" width="4" height="4" />
      <rect x="11.2" y="11.2" width="4" height="4" />
    </svg>
  )
}

/* ---- the three themes ----
   Sun and moon are the two assertions; the panel is the act of
   n'en faire aucune et de suivre la machine. */

export function SunIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.4v1.3M8 13.3v1.3M1.4 8h1.3M13.3 8h1.3M3.3 3.3l.9.9M11.8 11.8l.9.9M12.7 3.3l-.9.9M4.2 11.8l-.9.9" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3a5.7 5.7 0 1 0 6.6 6.6Z" />
    </svg>
  )
}

/** An instrument panel: whatever the machine decides, the tool takes up. */
export function SystemIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <rect x="2" y="3" width="12" height="8.5" rx="1" />
      <path d="M6 14h4" />
    </svg>
  )
}

export function AlertIcon() {
  return (
    <svg {...base} width={14} height={14}>
      <path d="M8 2.5v6.2M8 12.4v.6" />
    </svg>
  )
}

/**
 * The mark is the claim: a play triangle cut into scan lines, its lower half in
 * the accent. What Helix hands over is the top; what the sweep goes back for is
 * the part drawn in colour. One shape, and it says the whole product.
 *
 * Square, like everything else — the sheet sets `--r` to zero and a mark with
 * rounded bars beside unrounded thumbnails reads as a leftover.
 */
export function Mark() {
  return (
    <svg
      className="masthead-mark"
      width={20}
      height={20}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1.6" width="4" height="1.8" fill="var(--mark-quiet)" />
      <rect x="1" y="4.6" width="8" height="1.8" fill="var(--mark-quiet)" />
      <rect x="1" y="7.6" width="12" height="1.8" fill="var(--mark-quiet)" />
      <rect x="1" y="10.6" width="8" height="1.8" fill="var(--accent)" />
      <rect x="1" y="13.6" width="4" height="1.8" fill="var(--accent)" />
    </svg>
  )
}
