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
      <rect x="8.6" y="6.9" width="6.4" height="2.2" rx="0.6" fill="var(--violet-deep)" />
      <rect x="1" y="11.4" width="2.8" height="2.2" rx="0.6" fill="var(--violet-deep)" />
      <rect x="5" y="11.4" width="2.4" height="2.2" rx="0.6" fill="var(--violet)" />
      <rect x="8.6" y="11.4" width="2.4" height="2.2" rx="0.6" fill="var(--violet)" />
      <rect x="12.2" y="11.4" width="2.8" height="2.2" rx="0.6" fill="var(--red)" />
    </svg>
  )
}
