/**
 * Read-only projection of the gate catalog: the root manifest scripts named
 * `verify-*` plus the aggregate commands that run or compose gates. The
 * console lists and executes only scripts in this catalog.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gateInsightSchema, type GateInsight } from './contracts.js'

/** Aggregate commands that run or compose gates. */
export const GATE_SCRIPT_NAMES = [
  'doc-sync',
  'check:all',
  'lint',
  'typecheck',
  'test',
  'test:coverage',
  'build',
] as const

/** Return an object-shaped value, or undefined for every other shape. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/**
 * Whether one manifest script name belongs to the gate catalog.
 * @param script - script name from the root manifest.
 * @returns true for `verify-*` and the aggregate commands.
 */
export function isGateScript(script: string): boolean {
  return script.startsWith('verify-') || GATE_SCRIPT_NAMES.some(name => name === script)
}

/**
 * Read the gate commands declared by the root package manifest.
 *
 * @param repoRoot - repository root containing `package.json`.
 * @returns gates sorted by script name.
 * @throws When the manifest has no `scripts` object.
 */
export function readGates(repoRoot: string): GateInsight[] {
  const parsed: unknown = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
  const manifest = asRecord(parsed)
  if (manifest === undefined) throw new Error('package.json: expected a JSON object')
  const scripts = asRecord(manifest.scripts)
  if (scripts === undefined) throw new Error('package.json: expected a `scripts` object')

  const gates: GateInsight[] = []
  for (const [script, command] of Object.entries(scripts)) {
    if (typeof command !== 'string' || !isGateScript(script)) continue
    gates.push(gateInsightSchema.parse({ script, command }))
  }
  return gates.sort((left, right) => left.script.localeCompare(right.script))
}
