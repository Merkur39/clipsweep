import { describe, expect, it } from 'vitest'

import { claimedOffset } from './cursor'

/** Two nested base64 layers, the inner one a decimal count of items consumed. */
const cursorFor = (offset: number) =>
  btoa(JSON.stringify({ b: null, a: { Cursor: btoa(String(offset)) } }))

describe('claimedOffset', () => {
  // Helix answers a page of 100 with 97 clips and a cursor reading 100: the
  // three it kept to itself are unreachable, and this is the only place the
  // response admits to them. Measured on 2026-09-20 — see `windows.ts`.
  it('reads how many items Helix claims to have served', () => {
    expect(claimedOffset(cursorFor(100))).toBe(100)
  })

  it('reads a cursor as Helix actually shapes it', () => {
    expect(claimedOffset('eyJiIjpudWxsLCJhIjp7IkN1cnNvciI6Ik1qUT0ifX0')).toBe(24)
  })

  it('reads nothing from a cursor it cannot decode', () => {
    expect(claimedOffset('not-base64-at-all')).toBeNull()
    expect(claimedOffset(btoa('{"b":null}'))).toBeNull()
    expect(claimedOffset(btoa(JSON.stringify({ b: null, a: { Cursor: btoa('soon') } })))).toBeNull()
  })

  // The ledger it feeds must survive a reshaping rather than stop the sweep:
  // the offset is read for what it says about the gap, never to paginate.
  it('reads nothing from an absent cursor', () => {
    expect(claimedOffset(undefined)).toBeNull()
  })
})
