import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The fixture must not reach production, and "it should be dropped" is not the
 * same claim as "it was dropped".
 *
 * What actually drops it is that `import.meta.env.DEV` folds to `false`, taking
 * the dynamic import with it — so the module never enters the graph. That only
 * holds while the *sole* reference is dynamic and guarded. A static
 * `import … from './dev/fakeTwitch'` anywhere would pull it in silently: the
 * build would still succeed, the bundle would grow by a fixture, and nothing
 * would say so.
 *
 * Checked on the source rather than on `dist/`, deliberately. A test that reads
 * the built assets only means anything after a build, so it either forces one
 * into the suite or passes vacuously when the folder is stale — and neither is
 * a guard. This reads the invariant the bundler depends on.
 */
const SRC = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : []
  })
}

describe('the offline fixture stays out of the bundle', () => {
  it('is never imported statically, from anywhere', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => !path.includes(join('src', 'dev')))
      .filter((path) =>
        /^\s*import\s[^(]*['"][^'"]*dev\/fakeTwitch/m.test(readFileSync(path, 'utf8')),
      )

    expect(offenders).toEqual([])
  })

  it('is reached from the entry point only under the development guard', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8')

    // The reference exists at all — a rename that broke it would otherwise make
    // the case above pass by having nothing left to find.
    expect(main).toContain(`import('./dev/fakeTwitch')`)

    const guard = main.indexOf('import.meta.env.DEV')
    const reference = main.indexOf(`import('./dev/fakeTwitch')`)
    expect(guard).toBeGreaterThanOrEqual(0)
    expect(reference).toBeGreaterThan(guard)
  })
})
