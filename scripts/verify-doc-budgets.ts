/**
 * Enforce the standing-document ceilings in `scripts/doc-budgets.manifest.json`.
 * Missing files and invalid ceilings fail; `--list` reports current usage.
 *
 * The unit count is CJK-aware: every CJK character counts as one unit and every
 * whitespace-delimited non-CJK token counts as one, so a Chinese document and an
 * English document are measured on the same scale.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const MANIFEST_PATH = resolve(root, 'scripts/doc-budgets.manifest.json')

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/g

/** Count CJK characters plus whitespace-delimited non-CJK tokens. */
function countUnits(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0
  const tokens = text.replace(CJK, ' ').split(/\s+/).filter(Boolean).length
  return cjk + tokens
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, number>

const listOnly = process.argv.includes('--list')
const failures: string[] = []
const rows: string[] = []

for (const [path, ceiling] of Object.entries(manifest)) {
  if (!Number.isInteger(ceiling) || ceiling <= 0) {
    rows.push(`BAD   ${'—'.padStart(6)} / ${String(ceiling).padEnd(6)} ${path}`)
    failures.push(`${path}: ceiling must be a positive integer, got ${ceiling}`)
    continue
  }
  const abs = resolve(root, path)
  if (!existsSync(abs)) {
    rows.push(`MISS  ${'—'.padStart(6)} / ${String(ceiling).padEnd(6)} ${path}`)
    failures.push(`${path}: budgeted file does not exist (renamed or deleted? update scripts/doc-budgets.manifest.json in the same change)`)
    continue
  }
  const units = countUnits(readFileSync(abs, 'utf8'))
  rows.push(`${units <= ceiling ? 'ok  ' : 'OVER'}  ${String(units).padStart(6)} / ${String(ceiling).padEnd(6)} ${path}`)
  if (units > ceiling) {
    failures.push(`${path}: ${units} units exceeds the ${ceiling}-unit ceiling — relocate or condense per docs/AGENTS.md (raising the ceiling requires justification in the PR)`)
  }
}

if (listOnly) {
  console.log(rows.join('\n'))
  process.exit(0)
}

if (failures.length > 0) {
  console.error('verify-doc-budgets failed:\n')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('\nSee docs/AGENTS.md for the documentation standard and the relocation-first rule.')
  process.exit(1)
}

console.log(`verify-doc-budgets: ${Object.keys(manifest).length} budgeted docs within ceiling.`)
