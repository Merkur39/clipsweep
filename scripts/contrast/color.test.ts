import { describe, expect, it } from 'vitest'

import { contrastRatio, parseHex } from './color.ts'

describe('parseHex', () => {
  it('reads a six-digit hex', () => {
    expect(parseHex('#47d7b8')).toEqual([0x47, 0xd7, 0xb8])
  })

  it('accepts uppercase and a missing hash', () => {
    expect(parseHex('47D7B8')).toEqual([0x47, 0xd7, 0xb8])
  })

  it('expands a three-digit hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
  })

  it('refuses anything else, rather than returning a colour nobody asked for', () => {
    expect(() => parseHex('#12345')).toThrow(/hex/i)
    expect(() => parseHex('rebeccapurple')).toThrow(/hex/i)
  })
})

describe('contrastRatio', () => {
  it('gives 21 for black on white, the maximum sRGB allows', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it('gives 1 for a colour against itself', () => {
    expect(contrastRatio('#47d7b8', '#47d7b8')).toBeCloseTo(1, 5)
  })

  it('does not care which argument is the lighter one', () => {
    const a = contrastRatio('#767676', '#ffffff')
    const b = contrastRatio('#ffffff', '#767676')
    expect(a).toBeCloseTo(b, 10)
  })

  it('agrees with the WCAG reference value for #767676 on white', () => {
    // The canonical "smallest grey that still passes AA on white".
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('applies the sRGB transfer curve, not a naive channel average', () => {
    // A naive average would put mid-grey at ~2.6 against white; the real
    // curve puts it at 3.95. This is the assertion that catches a linearisation
    // mistake, which is otherwise invisible until a token lands two points off.
    expect(contrastRatio('#808080', '#ffffff')).toBeCloseTo(3.95, 2)
  })
})
