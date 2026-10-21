/**
 * Run the Vitest specs owned by the workspace packages a committed diff touches.
 *
 * Usage: node scripts/run-affected-tests.ts [--base <ref>]
 *
 * A changed path selects its owning workspace package (`apps/<name>` or
 * `packages/<name>`, found through the nearest ancestor holding a package.json)
 * and then every spec file under that package's `tests` directory; directly
 * changed spec files are always selected. Tests are found by package, not by a
 * same-named file, so a renamed or newly added source still selects that
 * package's specs.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DEFAULT_BASE = 'origin/main'
const USAGE = 'usage: node scripts/run-affected-tests.ts [--base <ref>]'
const SPEC_FILE_PATTERN = /\.spec\.tsx?$/u
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'lib', 'coverage'])

/** Invalid command line: reported with the usage line and exit code 2. */
class UsageError extends Error {}

/**
 * Parse the optional base ref.
 * @param args - Command-line arguments after the script path.
 * @returns the base ref compared against HEAD.
 */
function parseBase(args: readonly string[]): string {
  let base = DEFAULT_BASE
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument !== '--base') throw new UsageError(`unknown argument ${JSON.stringify(argument)}`)
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) throw new UsageError('--base requires a ref')
    base = value
    index += 1
  }
  return base
}

/**
 * List the repository-relative paths committed between `base` and HEAD.
 * @param base - Base ref; the comparison starts at its merge base with HEAD.
 * @returns normalized repository-relative paths.
 */
function changedPaths(base: string): string[] {
  const result = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    const detail = result.stderr.trim() || `git exited with status ${String(result.status)}`
    throw new Error(`cannot diff ${base}...HEAD: ${detail}`)
  }
  return result.stdout.split(/\r?\n/u).filter(Boolean).map(path => path.replaceAll('\\', '/'))
}

/**
 * Find the workspace package owning a changed path.
 * @param path - Repository-relative path of a changed file.
 * @returns the package directory, or undefined for paths outside `apps/*` and `packages/*`.
 */
function owningPackage(path: string): string | undefined {
  let directory = dirname(path)
  while (directory !== '.' && directory !== '') {
    if (existsSync(resolve(ROOT, directory, 'package.json'))) {
      const segments = directory.split('/')
      return segments.length === 2 && (segments[0] === 'apps' || segments[0] === 'packages')
        ? directory
        : undefined
    }
    directory = dirname(directory)
  }
  return undefined
}

/**
 * Collect the spec files below one directory.
 * @param directory - Absolute directory to walk.
 * @param found - Accumulator for absolute spec paths.
 * @returns the same accumulator.
 */
function collectSpecFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) collectSpecFiles(absolute, found)
      continue
    }
    // Symlinked specs are skipped so a link cycle cannot loop the walk.
    if (entry.isFile() && SPEC_FILE_PATTERN.test(entry.name)) found.push(absolute)
  }
  return found
}

/** Render an absolute path as a repository-relative path with `/` separators. */
function toRepoPath(absolute: string): string {
  return relative(ROOT, absolute).split(sep).join('/')
}

/**
 * Quote one argument for cmd.exe.
 * @param value - Argument to quote.
 * @returns the argument, quoted when it contains a space or a cmd metacharacter.
 */
function quoteArgument(value: string): string {
  return /[\s"&|<>^()]/u.test(value) ? `"${value}"` : value
}

/**
 * Run Vitest on the selected files.
 * @param files - Repository-relative spec paths.
 * @returns the Vitest exit status.
 */
function runVitest(files: readonly string[]): number {
  const args = ['exec', 'vitest', 'run', ...files]
  const result = process.platform === 'win32'
    // Node refuses to execute a .cmd shim directly; cmd.exe resolves whichever
    // pnpm launcher PATH holds (pnpm.cmd or pnpm.exe).
    ? spawnSync(['pnpm', ...args].map(quoteArgument).join(' '), {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
      shell: true,
    })
    : spawnSync('pnpm', args, { cwd: ROOT, env: process.env, stdio: 'inherit' })
  if (result.error !== undefined) throw result.error
  return result.status ?? 1
}

/**
 * Select the affected specs, report why the selection is empty when it is, and
 * run Vitest.
 * @param args - Command-line arguments after the script path.
 * @returns the process exit code.
 */
function main(args: readonly string[]): number {
  const base = parseBase(args)
  const changed = changedPaths(base)
  if (changed.length === 0) {
    console.log(`run-affected-tests: 0 affected tests: no committed path between ${base} and HEAD.`)
    return 0
  }

  const packages = new Set<string>()
  for (const path of changed) {
    const owner = owningPackage(path)
    if (owner !== undefined) packages.add(owner)
  }

  const selected = new Set<string>(
    changed.filter(path => SPEC_FILE_PATTERN.test(path) && existsSync(resolve(ROOT, path))),
  )
  for (const packageDirectory of [...packages].sort()) {
    const testsRoot = resolve(ROOT, packageDirectory, 'tests')
    if (existsSync(testsRoot)) for (const absolute of collectSpecFiles(testsRoot)) selected.add(toRepoPath(absolute))
  }

  if (selected.size === 0) {
    const owners = [...packages].sort().join(', ')
    if (packages.size === 0) {
      console.log(`run-affected-tests: 0 affected tests: none of the ${changed.length} changed path(s) vs ${base} belongs to an apps/<name> or packages/<name> workspace package.`)
    } else {
      console.error(`run-affected-tests: ${packages.size} workspace package(s) changed (${owners}) but none holds a tests/**/*.spec.ts(x) file; 0 tests selected, so this run provides no test evidence.`)
    }
    return 0
  }

  const targets = [...selected].sort()
  console.log(`run-affected-tests: ${targets.length} affected test file(s) vs ${base}:`)
  for (const target of targets) console.log(`  ${target}`)
  return runVitest(targets)
}

const entrypoint = process.argv[1]
if (entrypoint !== undefined && resolve(entrypoint) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`run-affected-tests: ${error instanceof Error ? error.message : String(error)}\n`)
    if (error instanceof UsageError) process.stderr.write(`${USAGE}\n`)
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}
