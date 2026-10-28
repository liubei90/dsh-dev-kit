/**
 * Point Git at the committed hooks in `.githooks/`.
 *
 * Runs from the `postinstall` script and can be re-run with
 * `node scripts/install-git-hooks.mjs` whenever `core.hooksPath` is missing or
 * points elsewhere. The hooks are POSIX shell scripts that Git for Windows runs
 * through its bundled `sh`; no extra binary is installed or required.
 */

import { spawnSync } from 'node:child_process'
import { chmodSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Directory holding the committed hooks, relative to the worktree root. */
const HOOKS_PATH = '.githooks'

/** Hook files that Git must be able to execute. */
const HOOK_FILES = ['pre-commit', 'pre-push']

const probe = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, encoding: 'utf8' })

if (probe.status !== 0) {
  console.log('install-git-hooks: not a Git worktree, skipping')
  process.exit(0)
}

if (process.platform !== 'win32') {
  for (const name of HOOK_FILES) chmodSync(join(ROOT, HOOKS_PATH, name), 0o755)
}

const configured = spawnSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd: ROOT, stdio: 'inherit' })

if (configured.status !== 0) {
  console.error('install-git-hooks: git config core.hooksPath failed')
  process.exit(1)
}

console.log(`install-git-hooks: core.hooksPath=${HOOKS_PATH}`)
