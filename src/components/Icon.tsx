/**
 * The whole icon vocabulary, drawn on one 16-unit grid with one stroke weight.
 * Unicode glyphs (▲ ▾ ×) render at whatever weight and baseline the visitor's
 * font stack happens to carry, which is not a decision anyone made.
 */

/* Two shapes rather than one holding both: an icon that turns does not resize
   and an icon that resizes does not turn, and a single interface let the wrong
   prop through to be dropped on the floor — `<CaretIcon size={20} />` compiled,
   and rendered at nine pixels. */

interface TurnableIcon {
  /** Rotation in degrees, for the carets that point four ways. */
  turn?: number
}

interface SizedIcon {
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

export function CaretIcon({ turn = 0 }: TurnableIcon) {
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

export function ChevronIcon({ turn = 0 }: TurnableIcon) {
  return (
    <svg {...base} style={turn ? { transform: `rotate(${turn}deg)` } : undefined}>
      <path d="M4 6.5 8 10.5l4-4" />
    </svg>
  )
}

/* The way back up, drawn as an arrow and not as the caret that means "sort":
   the two glyphs point the same way and say different things, so the one that
   moves the page carries a shaft. */
export function ArrowUpIcon() {
  return (
    <svg {...base} width={15} height={15}>
      <path d="M8 13.2V3.4M3.6 7.8 8 3.4l4.4 4.4" />
    </svg>
  )
}

/** 11 px in the fields it clears; the player asks for a bigger one. */
export function CloseIcon({ size = 11 }: SizedIcon = {}) {
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

/**
 * Twitch's own mark, drawn on its own 24-unit grid and filled rather than
 * stroked: it is a logo, not a member of this icon set, and redrawing it in the
 * house weight would make it a different logo.
 */
export function TwitchIcon() {
  return (
    <svg
      className="icon"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4.3 3 3 6.4v12.2h4.2V21h2.3l2.3-2.4h3.4L21 14.2V3H4.3Zm15 10.4-2.7 2.7h-3.4l-2.3 2.4v-2.4H6.7V4.6h12.6v8.8ZM15.6 7.4h1.7v4.8h-1.7V7.4Zm-4.5 0h1.7v4.8h-1.7V7.4Z" />
    </svg>
  )
}

/**
 * A filled square, like every stop button ever pressed. Solid rather than
 * outlined, and it has to be: an outlined square at 13px reads as an empty
 * checkbox, which is the one other square in this interface.
 */
export function StopIcon() {
  return (
    <svg {...base} width={12} height={12} fill="currentColor" stroke="none">
      <rect x="4" y="4" width="8" height="8" rx="1.6" />
    </svg>
  )
}

/** A lens and its handle: what is being looked through, not what is being found. */
export function SearchIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <circle cx="7" cy="7" r="4.2" />
      <path d="m10.2 10.2 3 3" />
    </svg>
  )
}

/** An arrow onto a floor: what comes down, and where it lands. */
export function DownloadIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M8 2.5v7.5M8 10l3-3M8 10 5 7" />
      <path d="M3 13h10" />
    </svg>
  )
}

/**
 * A box you are stepping out of, arrow first: the clip opens somewhere that is
 * not this page. It is the one glyph in the set that says "another tab", and
 * the corner it leaves through is the one the arrow points at.
 */
export function ExternalIcon() {
  return (
    <svg {...base} width={13} height={13}>
      <path d="M9.5 2.5H13.5v4M13.5 2.5 7.5 8.5" />
      <path d="M12 9.5v3.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5H7" />
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

export function GridIcon() {
  return (
    <svg {...base} width={13} height={13} strokeWidth={1.6}>
      <rect x="2.4" y="2.4" width="4.8" height="4.8" rx="0.6" />
      <rect x="8.8" y="2.4" width="4.8" height="4.8" rx="0.6" />
      <rect x="2.4" y="8.8" width="4.8" height="4.8" rx="0.6" />
      <rect x="8.8" y="8.8" width="4.8" height="4.8" rx="0.6" />
    </svg>
  )
}

/* The tighter grid, and the glyph says so the only way a glyph can: more cells
   in the same square, each smaller. Six against four, not nine — nine cells at
   13px close up into a grey block, and the icon that means "denser" would be
   the one that reads as nothing at all. */
export function GridTightIcon() {
  return (
    <svg {...base} width={13} height={13} strokeWidth={1.3}>
      <rect x="2.2" y="3" width="2.8" height="2.8" rx="0.5" />
      <rect x="6.6" y="3" width="2.8" height="2.8" rx="0.5" />
      <rect x="11" y="3" width="2.8" height="2.8" rx="0.5" />
      <rect x="2.2" y="8.4" width="2.8" height="2.8" rx="0.5" />
      <rect x="6.6" y="8.4" width="2.8" height="2.8" rx="0.5" />
      <rect x="11" y="8.4" width="2.8" height="2.8" rx="0.5" />
    </svg>
  )
}

/* ---- the three themes ----
   Sun and moon are the two assertions; the panel is the act of asserting
   neither, and following the machine. */

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
 * The mark is a run of clips, sorted: three bars falling away, and the tail the
 * search could not reach — drawn as dashes rather than as a bar, because what is
 * missing is exactly what cannot be drawn whole.
 *
 * It fades rather than changing hue: one accent, three weights. The mark it
 * replaces spent four colours on a story about the algorithm — a span halved,
 * halved again, one segment saturated at the floor — which is a diagram of how
 * the tool works rather than of what it is for.
 *
 * ⚠️ Three files carry this shape, and `scripts/geometry/mark.test.ts` holds them
 * to each other: this one, `public/favicon.svg`, and the rectangles
 * `scripts/make-favicon.ts` rasterises. This one is the authority.
 */
export function Mark() {
  return (
    <svg
      className="masthead-mark"
      width={24}
      height={20}
      viewBox="0 0 28 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.4" width="23" height="2.9" rx="1.45" fill="currentColor" />
      <rect x="2.5" y="9.2" width="17" height="2.9" rx="1.45" fill="currentColor" opacity="0.72" />
      <rect x="2.5" y="15" width="10.5" height="2.9" rx="1.45" fill="currentColor" opacity="0.46" />
      {/* Round caps on 1.9-long segments set 2.9 apart: the caps eat most of the
          gap and leave half a unit of it, which is what makes four dashes read
          as dashes at 24px rather than as one bar. */}
      <path
        d="M3.9 21.9h1.9m2.9 0h1.9m2.9 0h1.9m2.9 0h1.9"
        stroke="var(--text-faint)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
