import { describe, expect, it } from 'vitest'

import { readPalettes } from './tokens.ts'

describe('readPalettes', () => {
  it('splits a light-dark() pair into the two worlds', () => {
    const { light, dark } = readPalettes(`
      :root {
        --ground: light-dark(#f4f6f8, #0f1115);
        --text: light-dark(#21242a, #e8ebf0);
      }
    `)
    expect(light.get('ground')).toBe('#f4f6f8')
    expect(dark.get('ground')).toBe('#0f1115')
    expect(light.get('text')).toBe('#21242a')
    expect(dark.get('text')).toBe('#e8ebf0')
  })

  it('gives a flat colour to both worlds — no light-dark() means no difference', () => {
    const { light, dark } = readPalettes(':root { --on-accent-press: #e7e9f1; }')
    expect(light.get('on-accent-press')).toBe('#e7e9f1')
    expect(dark.get('on-accent-press')).toBe('#e7e9f1')
  })

  it('survives the whitespace a formatter produces', () => {
    const { dark } = readPalettes(`--x: light-dark(
        #ffffff,
        #000000
      );`)
    expect(dark.get('x')).toBe('#000000')
  })

  it('skips tokens that are not plain colours, instead of guessing', () => {
    const { light } = readPalettes(`
      --sans: system-ui, sans-serif;
      --wash: light-dark(rgb(107 63 212 / 10%), rgb(164 129 255 / 14%));
      --r: 2px;
      --ease: cubic-bezier(0.2, 0.8, 0.3, 1);
      --text: light-dark(#21242a, #e8ebf0);
    `)
    expect([...light.keys()]).toEqual(['text'])
  })

  it('keeps the last declaration when a token is redefined', () => {
    const { dark } = readPalettes(`
      --text: light-dark(#111111, #eeeeee);
      --text: light-dark(#222222, #dddddd);
    `)
    expect(dark.get('text')).toBe('#dddddd')
  })
})
