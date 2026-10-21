/**
 * Install the repository's lefthook Git hooks.
 *
 * Runs from the `postinstall` script and can be re-run with
 * `node scripts/install-lefthook.mjs` whenever hooks are missing. The launcher
 * pnpm writes into node_modules/.bin is platform-specific: Windows gets
 * `lefthook.cmd` (plus a `lefthook.ps1` companion), POSIX an extensionless shim.
 * Node cannot execute a `.cmd` file without a shell, so Windows runs the shim
 * through cmd.exe.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHIM_NAMES = process.platform === 'win32'
  ? ['lefthook.cmd', 'lefthook.ps1', 'lefthook']
  : ['lefthook']

/**
 * Locate the installed lefthook launcher.
 * @returns the absolute shim path, or undefined when pnpm installed no launcher.
 */
function resolveLefthook() {
  for (const name of SHIM_NAMES) {
    const candidate = join(ROOT, 'node_modules', '.bin', name)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * Run `lefthook install` through the launcher.
 * @param lefthook - Absolute path of the resolved launcher.
 */
function installHooks(lefthook) {
  const options = { cwd: ROOT, env: process.env, stdio: 'inherit' }
  // The quoted path is re-parsed by cmd.exe; PowerShell shims need their host.
  const result = lefthook.endsWith('.ps1')
    ? spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-File', lefthook, 'install'], options)
    : process.platform === 'win32'
      ? spawnSync(`"${lefthook}" install`, { ...options, shell: true })
      : spawnSync(lefthook, ['install'], options)
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) throw new Error(`lefthook install exited with status ${String(result.status)}`)
}

const lefthook = resolveLefthook()
if (lefthook === undefined) {
  console.error(
    'install-lefthook: no lefthook launcher in node_modules/.bin. '
    + 'Run `pnpm install` (which installs the lefthook devDependency), then re-run '
    + '`node scripts/install-lefthook.mjs`.',
  )
  process.exit(1)
}

try {
  installHooks(lefthook)
  console.log(`install-lefthook: hooks installed via ${lefthook}`)
} catch (error) {
  console.error(`install-lefthook: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
