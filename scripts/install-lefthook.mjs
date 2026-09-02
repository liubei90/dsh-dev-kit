/**
 * Install worktree-local lefthook hooks. Adapted from the DeepSeek Harness
 * installer (scripts/install-lefthook.mjs). Runs automatically via
 * `pnpm install` postinstall; re-run manually if hooks are missing.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
  const lefthook = resolve(ROOT, 'node_modules', '.bin', 'lefthook')
  if (!existsSync(lefthook)) {
    console.error('install-lefthook: lefthook not installed; run `pnpm install` first.')
    process.exit(1)
  }
  execFileSync(lefthook, ['install'], { cwd: ROOT, stdio: 'inherit' })
  console.log('install-lefthook: hooks installed.')
}
catch (error) {
  console.error('install-lefthook: failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
