import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Verdict } from './assumptions.ts'
import { emitReport } from './report.ts'

function verdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    id: 'sort-order',
    claim: 'claim',
    status: 'holds',
    severity: 'critical',
    detail: 'detail',
    ...overrides,
  }
}

let directory: string
let context: { channel: string; bodyPath: string }

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'canary-'))
  process.env.GITHUB_OUTPUT = join(directory, 'output')
  process.env.GITHUB_STEP_SUMMARY = join(directory, 'summary')
  context = { channel: 'somechannel', bodyPath: join(directory, 'issue.md') }
  // Captured rather than let through: the narration is meant for whoever reads
  // the run log, and seven calls to it turned this file's own output into
  // something to scroll past. `restoreMocks` puts the console back after each.
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

const outputs = () => readFileSync(process.env.GITHUB_OUTPUT!, 'utf8')
const narration = () => vi.mocked(console.log).mock.calls.map(([line]) => line)

describe('emitReport', () => {
  it('announces no drift while every assumption holds', () => {
    emitReport([verdict(), verdict({ id: 'cursor-shape' })], context)

    // The workflow gates the issue step on this exact string.
    expect(outputs()).toContain('drift=false')
  })

  it('writes no issue body when nothing drifted', () => {
    emitReport([verdict()], context)

    expect(() => readFileSync(context.bodyPath, 'utf8')).toThrow()
  })

  it('announces the drift and hands over a title and a marker', () => {
    emitReport([verdict({ status: 'drifted' })], context)

    expect(outputs()).toContain('drift=true')
    expect(outputs()).toMatch(/^title=.+$/m)
    expect(outputs()).toMatch(/^marker=<!-- api-canary drift=sort-order -->$/m)
  })

  it('keeps every output on one line, which is all the file format takes', () => {
    emitReport([verdict({ status: 'drifted', detail: 'a measurement\nover two lines' })], context)

    for (const line of outputs().trim().split('\n')) {
      expect(line).toMatch(/^[a-z]+=.*$/)
    }
  })

  it('writes the issue body where the workflow reads it', () => {
    emitReport([verdict({ status: 'drifted', detail: 'a precise measurement' })], context)

    expect(readFileSync(context.bodyPath, 'utf8')).toContain('a precise measurement')
  })

  // The third channel, alongside the output file and the issue body: the lines
  // a human scrolling the run log actually reads. Muting it in the tests above
  // would leave it the only one nothing checks.
  it('narrates every assumption, marking the ones that moved', () => {
    emitReport(
      [verdict({ id: 'sort-order' }), verdict({ id: 'cursor-shape', status: 'drifted' })],
      context,
    )

    expect(narration()).toEqual(['✓ sort-order — detail', '✗ cursor-shape — detail'])
  })

  it('summarises every assumption for the run page, drifting or not', () => {
    emitReport([verdict({ id: 'sort-order' }), verdict({ id: 'cursor-shape' })], context)

    const summary = readFileSync(process.env.GITHUB_STEP_SUMMARY!, 'utf8')
    expect(summary).toContain('sort-order')
    expect(summary).toContain('cursor-shape')
  })

  it('runs outside Actions, where none of those files exist', () => {
    delete process.env.GITHUB_OUTPUT
    delete process.env.GITHUB_STEP_SUMMARY

    expect(() => emitReport([verdict({ status: 'drifted' })], context)).not.toThrow()
  })
})
