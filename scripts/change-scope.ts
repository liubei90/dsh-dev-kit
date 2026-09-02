/**
 * Print the files changed between two refs (or against the merge base),
 * plus staged/unstaged/untracked worktree paths. Adapted from the DeepSeek
 * Harness change-scope command. This is the foundation of "run the smallest
 * evidence set" (pre-push-checks).
 *
 * Usage: pnpm run change-scope --base <ref> [--head <ref>]
 */

import { execFileSync } from 'node:child_process'

function run(args: string[]): string[] {
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)
}

const argv = process.argv.slice(2)
const baseIdx = argv.indexOf('--base')
const headIdx = argv.indexOf('--head')
if (baseIdx < 0 || baseIdx + 1 >= argv.length) {
  console.error('usage: change-scope --base <ref> [--head <ref>]')
  process.exit(2)
}
const base = argv[baseIdx + 1] ?? ''
const head = headIdx >= 0 ? argv[headIdx + 1] ?? 'HEAD' : 'HEAD'

const changed = new Set<string>()

// Committed paths relative to the merge base.
for (const line of run(['diff', '--name-only', `${base}...${head}`])) changed.add(line)

// Staged, unstaged, and untracked worktree paths.
for (const line of run(['diff', '--name-only', 'HEAD'])) changed.add(line)
for (const line of run(['diff', '--cached', '--name-only'])) changed.add(line)
for (const line of run(['ls-files', '--others', '--exclude-standard'])) changed.add(line)

const sorted = [...changed].sort()
for (const f of sorted) console.log(f)
console.error(`change-scope: ${sorted.length} path(s) in scope (base ${base} → head ${head}).`)
