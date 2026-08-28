/**
 * The rule that decides whether a palette is legible.
 *
 * Two things it does that a spot check does not:
 *
 *  · **Every ink is measured against every surface**, and the worst pairing is
 *    the one reported. An ink chosen against the page background alone passes
 *    on paper and fails on the hovered row, which is where a date gets read.
 *  · **A rule that stops matching is a finding.** Renaming a token used to
 *    disable its check in silence, and silence is indistinguishable from
 *    success — the failure mode this repository has already met once.
 */

import { contrastRatio } from './color.ts'
import type { Palette } from './tokens.ts'

/** WCAG 1.4.3: body text. */
const INK_MIN = 4.5
/** WCAG 1.4.11: a control boundary, or anything that has to be seen. */
const MARK_MIN = 3

export type Rules = {
  /** Every token a piece of text can sit on. */
  surfaces: string[]
  /** Tokens that write. Held to 4.5 against the worst surface. */
  inks: string[]
  /** Tokens that must be visible without being read. Held to 3. */
  marks: string[]
  /** A filled control and the label it carries. */
  flats: { flat: string; label: string }[]
}

export type Finding = {
  kind: 'ink' | 'mark' | 'flat' | 'flat-surface' | 'missing'
  token: string
  against: string
  ratio: number
  min: number
}

const worstAgainst = (colour: string, surfaces: string[], palette: Palette) =>
  surfaces.reduce(
    (worst, name) => {
      const ratio = contrastRatio(colour, palette.get(name)!)
      return ratio < worst.ratio ? { against: name, ratio } : worst
    },
    { against: '', ratio: Infinity },
  )

export function checkPalette(palette: Palette, rules: Rules): Finding[] {
  const findings: Finding[] = []

  const named = [
    ...rules.surfaces,
    ...rules.inks,
    ...rules.marks,
    ...rules.flats.flatMap((f) => [f.flat, f.label]),
  ]
  for (const token of new Set(named)) {
    if (!palette.has(token)) {
      findings.push({ kind: 'missing', token, against: '', ratio: 0, min: 0 })
    }
  }
  if (findings.length > 0) return findings

  for (const [tokens, min, kind] of [
    [rules.inks, INK_MIN, 'ink'],
    [rules.marks, MARK_MIN, 'mark'],
  ] as const) {
    for (const token of tokens) {
      const { against, ratio } = worstAgainst(palette.get(token)!, rules.surfaces, palette)
      if (ratio < min) findings.push({ kind, token, against, ratio, min })
    }
  }

  for (const { flat, label } of rules.flats) {
    const colour = palette.get(flat)!
    const onLabel = contrastRatio(colour, palette.get(label)!)
    if (onLabel < INK_MIN) {
      findings.push({ kind: 'flat', token: flat, against: label, ratio: onLabel, min: INK_MIN })
    }
    const { against, ratio } = worstAgainst(colour, rules.surfaces, palette)
    if (ratio < MARK_MIN) {
      findings.push({ kind: 'flat-surface', token: flat, against, ratio, min: MARK_MIN })
    }
  }

  return findings
}

export function describeFinding(finding: Finding): string {
  if (finding.kind === 'missing') {
    return `--${finding.token} is named by a rule but absent from the palette; its check never ran.`
  }
  const what = {
    ink: 'reads at',
    mark: 'is visible at',
    flat: 'carries its label at',
    'flat-surface': 'stands out from its surface at',
  }[finding.kind]
  return `--${finding.token} ${what} ${finding.ratio.toFixed(2)} on --${finding.against}, under ${finding.min}.`
}
