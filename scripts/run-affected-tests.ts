/**
 * Run only the tests affected by the current diff (against origin/main or the
 * given base). Backing implementation for `pnpm run test:affected`.
 *
 * Usage: pnpm run test:affected [--base <ref>]
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

function run(args: string[]): string[] {
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)
}

const argv = process.argv.slice(2)
const baseIdx = argv.indexOf('--base')
const base = baseIdx >= 0 ? argv[baseIdx + 1] ?? 'origin/main' : 'origin/main'

// Files changed on this branch vs the base.
const changed = run(['diff', '--name-only', `${base}...HEAD`])

// Map a changed source file to a candidate test file next to it.
const testCandidates = new Set<string>()
for (const file of changed) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
  const dir = file.slice(0, file.lastIndexOf('/'))
  const stem = file.slice(file.lastIndexOf('/') + 1).replace(/\.(ts|tsx)$/, '')
  // Same-directory spec: <stem>.spec.ts / <stem>.test.ts
  for (const suffix of ['.spec.ts', '.test.ts']) {
    const candidate = `${dir}/${stem}${suffix}`
    if (existsSync(resolve(ROOT, candidate))) testCandidates.add(candidate)
  }
  // Adjacent tests/ directory: <dir>/tests/<stem>.spec.ts
  const testsCandidate = `${dir}/tests/${stem}.spec.ts`
  if (existsSync(resolve(ROOT, testsCandidate))) testCandidates.add(testsCandidate)
}

if (testCandidates.size === 0) {
  console.log(`test:affected: no affected test files (${changed.length} changed path(s) vs ${base}).`)
  process.exit(0)
}

const targets = [...testCandidates].sort()
console.log(`test:affected: running ${targets.length} affected test file(s):`)
for (const t of targets) console.log(`  ${t}`)
execFileSync('pnpm', ['exec', 'vitest', 'run', ...targets], { cwd: ROOT, stdio: 'inherit' })
