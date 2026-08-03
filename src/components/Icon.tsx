/**
 * The whole icon vocabulary, drawn on one 16-unit grid with one stroke weight.
 * Unicode glyphs (▲ ▾ ×) render at whatever weight and baseline the visitor's
 * font stack happens to carry, which is not a decision anyone made.
 */

interface IconProps {
  /** Rotation in degrees, for the carets that point four ways. */
  turn?: number
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

export function CloseIcon() {
  return (
    <svg {...base} width={11} height={11}>
      <path d="M4 4l8 8M12 4l-8 8" />
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
 * The mark is the mechanism: one span of time, halved, halved again — and one
 * segment that stayed saturated at the floor, which the tool declares rather
 * than hides. It is the frieze's legend, compressed.
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
      <rect x="1" y="2.4" width="14" height="2.2" rx="0.6" fill="var(--rule-strong)" />
      <rect x="1" y="6.9" width="6.4" height="2.2" rx="0.6" fill="var(--rule-strong)" />
      <rect x="8.6" y="6.9" width="6.4" height="2.2" rx="0.6" fill="var(--violet-half)" />
      <rect x="1" y="11.4" width="2.8" height="2.2" rx="0.6" fill="var(--violet-half)" />
      <rect x="5" y="11.4" width="2.4" height="2.2" rx="0.6" fill="var(--violet)" />
      <rect x="8.6" y="11.4" width="2.4" height="2.2" rx="0.6" fill="var(--violet)" />
      <rect x="12.2" y="11.4" width="2.8" height="2.2" rx="0.6" fill="var(--red)" />
    </svg>
  )
}
