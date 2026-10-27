/**
 * Run one aggregate of the repository's quality gates and report the outcome.
 *
 * Usage: node scripts/run-gates.ts <doc-sync|check-all>
 *
 * A gate is one `pnpm run <script>` invocation. `doc-sync` is also a gate that
 * only lists dependencies, so `check-all` composes it instead of repeating the
 * ten documentation scripts, and every such script still runs exactly once.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** Repository root, used as the working directory of every gate. */
const ROOT = resolve(import.meta.dirname, '..')

/** Usage line printed for a missing or unknown mode. */
const USAGE = 'usage: node scripts/run-gates.ts <doc-sync|check-all>'

/** One gate of a mode graph: an npm script, or a group that only orders dependencies. */
interface Gate {
  /** Stable id used by mode membership and by other gates' `needs`. */
  readonly id: string
  /** Operator-facing label printed around the gate output. */
  readonly label: string
  /** npm script this gate runs; absent on a group gate. */
  readonly script?: string
  /** Gate ids that must succeed before this gate is scheduled. */
  readonly needs?: readonly string[]
}

/** Declare a gate that runs one npm script. */
function scriptGate(id: string, script: string, label: string = script): Gate {
  return { id, label, script }
}

/** The frozen documentation gate ids, in reporting order. */
const DOCUMENTATION_GATE_IDS: readonly string[] = [
  'markdown-links',
  'markdown-wrap',
  'doc-typecheck',
  'agent-note-classification',
  'agent-note-format',
  'archived-agent-notes',
  'persistence-catalog',
  'persistence-changes',
  'doc-budgets',
  'skill-invocation-metadata',
]

/** Every declared gate; `needs` may reference any id in this list. */
const GATES: readonly Gate[] = [
  scriptGate('markdown-links', 'verify-md-links', 'markdown links'),
  scriptGate('markdown-wrap', 'verify-md-wrap', 'markdown wrap'),
  scriptGate('doc-typecheck', 'doc-typecheck', 'documentation typecheck'),
  scriptGate('agent-note-classification', 'verify-agent-note-classification', 'agent note classification'),
  scriptGate('agent-note-format', 'verify-agent-note-format', 'agent note format'),
  scriptGate('archived-agent-notes', 'verify-archived-agent-notes', 'archived agent notes'),
  scriptGate('persistence-catalog', 'verify-persistence-catalog', 'persistence catalog'),
  scriptGate('persistence-changes', 'verify-persistence-changes', 'persistence changes'),
  scriptGate('doc-budgets', 'verify-doc-budgets', 'documentation budgets'),
  scriptGate('skill-invocation-metadata', 'verify-skill-invocation-metadata', 'skill invocation metadata'),
  // A group gate: `check-all` depends on it, and it expands to the scripts above.
  { id: 'doc-sync', label: 'documentation gates', needs: DOCUMENTATION_GATE_IDS },
  scriptGate('lint', 'lint'),
  scriptGate('typecheck', 'typecheck'),
  scriptGate('test', 'test'),
  scriptGate('build', 'build'),
]

/** Mode membership; dependencies are pulled in transitively through `needs`. */
const MODES: Readonly<Record<string, readonly string[]>> = {
  'doc-sync': ['doc-sync'],
  'check-all': ['doc-sync', 'lint', 'typecheck', 'test', 'build'],
}

/** Look up one declared gate. */
function gateById(id: string): Gate {
  const gate = GATES.find(candidate => candidate.id === id)
  if (gate === undefined) throw new Error(`unknown gate ${JSON.stringify(id)}`)
  return gate
}

/** Fail before any gate runs when a dependency name is not declared at all. */
function assertKnownDependencies(): void {
  const known = new Set(GATES.map(gate => gate.id))
  for (const gate of GATES) {
    for (const need of gate.needs ?? []) {
      if (!known.has(need)) throw new Error(`gate ${JSON.stringify(gate.id)} needs unknown gate ${JSON.stringify(need)}`)
    }
  }
}

/**
 * Expand mode membership into dependency levels: gates in one level are
 * independent, and every gate appears at most once.
 * @param members - gate ids named by the selected mode.
 * @returns levels in execution order.
 */
function planLevels(members: readonly string[]): Gate[][] {
  const pending = new Map<string, Gate>()
  const queue = [...members]
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (pending.has(id)) continue
    const gate = gateById(id)
    pending.set(id, gate)
    queue.push(...gate.needs ?? [])
  }

  const levels: Gate[][] = []
  const satisfied = new Set<string>()
  while (pending.size > 0) {
    const level = [...pending.values()].filter(gate => (gate.needs ?? []).every(need => satisfied.has(need)))
    if (level.length === 0) {
      throw new Error(`dependency cycle among ${[...pending.keys()].join(', ')}`)
    }
    for (const gate of level) {
      satisfied.add(gate.id)
      pending.delete(gate.id)
    }
    levels.push(level)
  }
  return levels
}

/**
 * Read the one supported scheduling switch.
 * @param env - Environment holding `GATE_CONCURRENCY`.
 * @returns the maximum number of gates allowed to run at once; 1 (serial) by default.
 */
function readConcurrency(env: NodeJS.ProcessEnv): number {
  const raw = env.GATE_CONCURRENCY
  if (raw === undefined || raw === '') return 1
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || String(parsed) !== raw) {
    throw new Error(`GATE_CONCURRENCY must be a positive integer, got ${JSON.stringify(raw)}`)
  }
  return parsed
}

/** A resolved command line for one gate. */
interface CommandInvocation {
  readonly command: string
  readonly args: readonly string[]
  readonly useShell: boolean
}

/**
 * Resolve the pnpm process to run a gate with.
 * @param args - Arguments passed to pnpm.
 * @returns A shell-free invocation when pnpm recorded its entry point, otherwise
 * the platform shim resolved through cmd.exe on Windows.
 */
function pnpmInvocation(args: readonly string[]): CommandInvocation {
  const entrypoint = process.env.npm_execpath
  if (entrypoint !== undefined && entrypoint !== '') {
    return /\.[cm]?js$/iu.test(entrypoint)
      ? { command: process.execPath, args: [entrypoint, ...args], useShell: false }
      : { command: entrypoint, args: [...args], useShell: false }
  }
  return { command: 'pnpm', args: [...args], useShell: process.platform === 'win32' }
}

/** Run one command with inherited stdio and resolve with its exit status. */
function runCommand(invocation: CommandInvocation): Promise<number | null> {
  return new Promise((resolvePromise, rejectPromise) => {
    const options = { cwd: ROOT, env: process.env, stdio: 'inherit' } as const
    const child = invocation.useShell
      // cmd.exe re-parses one command string; a separate argument vector would
      // trip the shell-argument deprecation while adding no quoting benefit.
      ? spawn([invocation.command, ...invocation.args].join(' '), { ...options, shell: true })
      : spawn(invocation.command, [...invocation.args], options)
    child.once('error', rejectPromise)
    child.once('close', (code) => { resolvePromise(code) })
  })
}

/**
 * Run one gate.
 * @param gate - Gate to execute.
 * @returns 0 when the gate passed, 1 when it failed or was terminated.
 */
async function runGate(gate: Gate): Promise<number> {
  if (gate.script === undefined) {
    process.stdout.write(`[run-gates] ${gate.label}: dependency group satisfied\n`)
    return 0
  }
  process.stdout.write(`[run-gates] ${gate.label} (pnpm run ${gate.script})\n`)
  const status = await runCommand(pnpmInvocation(['run', gate.script]))
  if (status === 0) {
    process.stdout.write(`[run-gates] ${gate.label}: ok\n`)
    return 0
  }
  process.stderr.write(`[run-gates] ${gate.label}: FAILED (exit ${status === null ? 'signal' : String(status)})\n`)
  return 1
}

/**
 * Run one level's independent gates.
 * @param level - Gates whose dependencies already succeeded.
 * @param concurrency - Maximum number of gates running at once.
 * @param failures - Failure list, appended in completion order; a non-empty list
 * stops this level from starting further gates.
 */
async function runLevel(level: readonly Gate[], concurrency: number, failures: string[]): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, level.length) }, async () => {
    while (failures.length === 0) {
      const gate = level[cursor]
      if (gate === undefined) return
      cursor += 1
      if (await runGate(gate) !== 0) failures.push(gate.id)
    }
  })
  await Promise.all(workers)
}

/**
 * Parse the mode argument, run its gates, and report the exit code.
 * @returns 0 when every gate passed, 1 after a gate failure, 2 for a usage or graph error.
 */
async function main(): Promise<number> {
  const mode = process.argv[2]
  if (mode === undefined || !Object.hasOwn(MODES, mode)) {
    if (mode !== undefined) process.stderr.write(`run-gates: unknown mode ${JSON.stringify(mode)}\n`)
    process.stderr.write(`${USAGE}\n`)
    return 2
  }

  let levels: Gate[][]
  let concurrency: number
  try {
    assertKnownDependencies()
    levels = planLevels(MODES[mode] ?? [])
    concurrency = readConcurrency(process.env)
  } catch (error) {
    process.stderr.write(`run-gates: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }

  const scheduled = levels.flat().filter(gate => gate.script !== undefined).length
  process.stdout.write(`[run-gates] mode ${mode}: ${scheduled} gate(s), concurrency ${concurrency}\n`)
  const failures: string[] = []
  for (const level of levels) {
    await runLevel(level, concurrency, failures)
    if (failures.length > 0) break
  }

  if (failures.length > 0) {
    process.stderr.write(`[run-gates] ${mode}: ${failures.length} gate(s) failed: ${failures.join(', ')}\n`)
    return 1
  }
  process.stdout.write(`[run-gates] ${mode}: all ${scheduled} gate(s) passed\n`)
  return 0
}

const entrypoint = process.argv[1]
if (entrypoint !== undefined && resolve(entrypoint) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main()
}
