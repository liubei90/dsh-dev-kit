/**
 * Verify every workspace package's declared entry points exist in its build
 * output and load under Node.
 *
 * `build:check` runs this after `build:artifacts`: a manifest that points at a
 * file `tsc` never emits (for example `main: lib/index.js` with outDir
 * `lib/types`) passes the source-plane typecheck and fails only here.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')

/** The manifest fields that name a build output. */
interface WorkspaceManifest {
  readonly name?: string
  readonly main?: string
  readonly types?: string
  readonly exports?: string | Record<string, string | Record<string, string>>
}

/** One workspace package directory and its manifest. */
interface Workspace {
  readonly relativeDir: string
  readonly manifest: WorkspaceManifest
}

/** Collect `apps/<name>` and `packages/<name>` manifests that declare entries. */
function workspaces(): Workspace[] {
  const out: Workspace[] = []
  for (const group of ['apps', 'packages']) {
    const groupRoot = resolve(root, group)
    if (!existsSync(groupRoot)) continue
    for (const entry of readdirSync(groupRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const relativeDir = `${group}/${entry.name}`
      const manifestPath = resolve(root, relativeDir, 'package.json')
      if (!existsSync(manifestPath)) continue
      out.push({
        relativeDir,
        manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) as WorkspaceManifest,
      })
    }
  }
  return out.sort((a, b) => a.relativeDir.localeCompare(b.relativeDir))
}

/** Every declared build-output path with a label for diagnostics. */
function declaredEntries(manifest: WorkspaceManifest): { label: string; path: string; runtime: boolean }[] {
  const entries: { label: string; path: string; runtime: boolean }[] = []
  if (manifest.main !== undefined) entries.push({ label: 'main', path: manifest.main, runtime: true })
  if (manifest.types !== undefined) entries.push({ label: 'types', path: manifest.types, runtime: false })

  const exported = manifest.exports
  if (typeof exported === 'string') {
    entries.push({ label: 'exports', path: exported, runtime: true })
  }
  else if (exported !== undefined) {
    const dot = exported['.']
    if (typeof dot === 'string') {
      entries.push({ label: 'exports["."]', path: dot, runtime: true })
    }
    else if (dot !== undefined) {
      const types = dot.types
      const fallback = dot.default ?? dot.import
      if (types !== undefined) entries.push({ label: 'exports["."].types', path: types, runtime: false })
      if (fallback !== undefined) entries.push({ label: 'exports["."].default', path: fallback, runtime: true })
    }
  }
  return entries
}

const failures: string[] = []
let checked = 0

for (const { relativeDir, manifest } of workspaces()) {
  const name = manifest.name ?? relativeDir
  const entries = declaredEntries(manifest)
  if (entries.length === 0) {
    failures.push(`${name}: no main/types/exports declared, so the package cannot be consumed from its build output`)
    continue
  }

  for (const entry of entries) {
    checked += 1
    const absolute = resolve(root, relativeDir, entry.path)
    if (!existsSync(absolute)) {
      failures.push(`${name}: ${entry.label} -> ${entry.path} does not exist in the build output (run build:artifacts first)`)
      continue
    }
    if (!entry.runtime) continue
    try {
      await import(pathToFileURL(absolute).href)
    }
    catch (error) {
      failures.push(`${name}: ${entry.label} -> ${entry.path} failed to load: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

if (failures.length > 0) {
  process.stderr.write('check-built-exports: build output does not match the package manifests:\n')
  for (const failure of failures) process.stderr.write(`  ${failure}\n`)
  process.exit(1)
}

process.stdout.write(`check-built-exports: ${String(checked)} declared entry path(s) exist and load.\n`)
