/**
 * Aggregate the documentation gates (doc-sync) and the full local gate set
 * (check:all). Each verify script exits non-zero on violation.
 *
 * Usage:
 *   pnpm run doc-sync        # documentation gates
 *   pnpm run check:all       # everything
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

function runScript(script: string, label: string): void {
  process.stdout.write(`— ${label} … `)
  try {
    execFileSync(process.execPath, ['--import', 'tsx', script], { cwd: ROOT, stdio: 'pipe' })
    console.log('ok')
  }
  catch (error) {
    console.log('FAILED')
    const stderr = error instanceof Error && 'stderr' in error
      ? String((error as { stderr?: Buffer }).stderr ?? '')
      : String(error)
    if (stderr) process.stderr.write(stderr)
    process.exitCode = 1
  }
}

/** Verify the word-count budgets in scripts/doc-budgets.manifest.json. */
function verifyDocBudgets(): void {
  const manifestPath = resolve(ROOT, 'scripts', 'doc-budgets.manifest.json')
  if (!existsSync(manifestPath)) { console.log('— doc budgets … skipped (no manifest)'); return }
  const budgets = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, number>
  process.stdout.write('— doc budgets … ')
  let failed = false
  for (const [file, budget] of Object.entries(budgets)) {
    const abs = resolve(ROOT, file)
    if (!existsSync(abs)) { console.error(`\n  missing budgeted file: ${file}`); failed = true; continue }
    const words = readFileSync(abs, 'utf8').split(/\s+/).filter(Boolean).length
    if (words > budget) { console.error(`\n  ${file}: ${words} words > budget ${budget}`); failed = true }
  }
  if (failed) { process.exitCode = 1; console.log('FAILED') } else console.log('ok')
}

const DOC_GATES: Array<[string, string]> = [
  ['scripts/verify-agent-note-format.ts', 'agent note format'],
  ['scripts/verify-archived-agent-notes.ts', 'archived agent notes'],
]

const ALL_GATES: Array<[string, string]> = [
  ...DOC_GATES,
  ['scripts/verify-md-links.ts', 'markdown links'],
  ['scripts/verify-md-wrap.ts', 'markdown wrap'],
]

const all = process.argv.includes('check-all')
for (const [script, label] of (all ? ALL_GATES : DOC_GATES)) {
  runScript(resolve(ROOT, script), label)
}
verifyDocBudgets()

if (process.exitCode === undefined) console.log(`${all ? 'check:all' : 'doc-sync'}: all gates passed.`)
else console.error(`${all ? 'check:all' : 'doc-sync'}: gates failed.`)
