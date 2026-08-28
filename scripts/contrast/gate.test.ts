import { describe, expect, it } from 'vitest'

import { checkPalette, describeFinding, type Rules } from './gate.ts'

const rules: Rules = {
  surfaces: ['ground', 'surface'],
  inks: ['text'],
  marks: ['rule-control'],
  flats: [{ flat: 'accent', label: 'on-accent' }],
}

const palette = (over: Record<string, string> = {}) =>
  new Map(
    Object.entries({
      ground: '#0f1115',
      surface: '#191d24',
      text: '#e8ebf0',
      'rule-control': '#6c7178',
      accent: '#47d7b8',
      'on-accent': '#06231d',
      ...over,
    }),
  )

describe('checkPalette', () => {
  it('passes a palette where every ink and mark clears its threshold', () => {
    expect(checkPalette(palette(), rules)).toEqual([])
  })

  it('reports an ink that falls under 4.5 on any single surface', () => {
    // Holds on `ground` (4.69) but not on the lighter `surface` (4.19).
    const findings = checkPalette(palette({ text: '#787f8b' }), rules)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'ink', token: 'text', against: 'surface', min: 4.5 })
    expect(findings[0].ratio).toBeLessThan(4.5)
  })

  it('names the WORST surface, not the first one that fails', () => {
    const findings = checkPalette(palette({ text: '#555a63' }), rules)
    expect(findings[0].against).toBe('surface')
  })

  it('holds marks to 3, not to 4.5 — a border is not a paragraph', () => {
    expect(checkPalette(palette({ 'rule-control': '#6c7178' }), rules)).toEqual([])
    expect(checkPalette(palette({ 'rule-control': '#3a3f46' }), rules)).toHaveLength(1)
  })

  it('measures a flat by its own label, not by the surface behind it', () => {
    const findings = checkPalette(palette({ 'on-accent': '#3a9c88' }), rules)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'flat', token: 'accent', against: 'on-accent' })
  })

  it('also asks that a flat detach from its surface — an invisible button is not a button', () => {
    const findings = checkPalette(palette({ accent: '#1b2028', 'on-accent': '#ffffff' }), rules)
    expect(findings.some((f) => f.kind === 'flat-surface')).toBe(true)
  })

  /**
   * The trap this repository has already hit once: a rule that silently stops
   * matching reports nothing, and nothing is indistinguishable from success.
   */
  it('reports a rule that names a token the palette does not have', () => {
    const short = palette()
    short.delete('rule-control')
    const findings = checkPalette(short, rules)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'missing', token: 'rule-control' })
  })
})

describe('describeFinding', () => {
  it('reads as a sentence with its two numbers', () => {
    const [finding] = checkPalette(palette({ text: '#787f8b' }), rules)
    expect(describeFinding(finding)).toMatch(/--text/)
    expect(describeFinding(finding)).toMatch(/--surface/)
    expect(describeFinding(finding)).toMatch(/4\.5/)
  })
})
