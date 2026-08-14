/**
 * What the probe hands back to the workflow.
 *
 * The contract is narrow and worth testing: the issue step is gated on
 * `drift=true`, titles and markers travel through `GITHUB_OUTPUT` — a file
 * format that takes one line per value — and the body travels as a file
 * precisely because it does not fit that format.
 */
import { appendFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

import { renderIssue, summarize, type Verdict } from './assumptions.ts'

export interface ReportContext {
  channel: string
  /** Where the workflow's `gh issue create --body-file` will look. */
  bodyPath: string
}

export function emitReport(verdicts: Verdict[], { channel, bodyPath }: ReportContext): void {
  const summary = summarize(verdicts)

  for (const verdict of verdicts) {
    console.log(`${verdict.status === 'holds' ? '✓' : '✗'} ${verdict.id} — ${verdict.detail}`)
  }

  // The run page keeps the whole picture, drift or not: a green canary that
  // says nothing is indistinguishable from one that never ran.
  writeSummary(
    [
      '| | Assumption | Measured |',
      '| --- | --- | --- |',
      ...verdicts.map(
        (verdict) =>
          `| ${verdict.status === 'holds' ? '✓' : '✗'} | \`${verdict.id}\` | ${verdict.detail} |`,
      ),
    ].join('\n'),
  )

  if (!summary.shouldAlert) {
    setOutput('drift', 'false')
    return
  }

  const { title, body } = renderIssue(verdicts, {
    channel,
    checkedAt: new Date().toISOString().slice(0, 10),
    runUrl: runUrl(),
  })

  writeFileSync(bodyPath, `${body}\n`, 'utf8')
  setOutput('drift', 'true')
  setOutput('title', title)
  setOutput('marker', summary.marker)
}

function runUrl(): string {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return 'local run'
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
}

/**
 * `key=value` only holds while the value stays on one line — the heredoc form
 * exists for the rest. Nothing sent here is meant to be multi-line, so a stray
 * newline is flattened rather than given a syntax that would hide it.
 */
function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT
  if (file) appendFileSync(file, `${name}=${value.replace(/\s*\n\s*/g, ' ')}\n`, 'utf8')
}

function writeSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY
  if (file) appendFileSync(file, `${markdown}\n`, 'utf8')
}
