/**
 * Gate execution owned by one console process. The runner starts at most one
 * `pnpm run <script>` at a time, captures bounded output, enforces a timeout,
 * and tears the whole child process tree down on timeout or shutdown.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { GateInsight, GateRun, GateRunStatus } from '@devkit/repo'
import { MAX_RUN_HISTORY } from '../config.js'

/** Raised when a second run starts while one is active. */
export class GateRunConflictError extends Error {
  constructor() {
    super('A gate run is already active.')
    this.name = 'GateRunConflictError'
  }
}

/** Runner limits and the repository whose scripts execute. */
export interface GateRunnerOptions {
  readonly repoRoot: string
  /** Wall-clock limit per run, in milliseconds. */
  readonly timeoutMs: number
  /** Maximum bytes kept from each output stream. */
  readonly outputBytes: number
}

/** Gate execution surface used by the HTTP routes. */
export interface GateRunner {
  /** Script of the active run, or undefined when idle. */
  readonly activeScript: string | undefined
  /** Start one catalog gate; throws when another run is active. */
  start(gate: GateInsight): GateRun
  /** Look up one remembered run. */
  get(id: string): GateRun | undefined
  /** Remembered runs, newest first. */
  list(): readonly GateRun[]
  /** Kill the active run and wait briefly for it to settle. */
  stopAll(): Promise<void>
}

/** One running child plus the promise that settles with it. */
interface ActiveRun {
  readonly run: GateRun
  readonly child: ChildProcess
  readonly done: Promise<void>
}

/** Quote one script name for the Windows shell fallback. */
function quoteArgument(value: string): string {
  return /[\s"&|<>^()]/u.test(value) ? `"${value}"` : value
}

/** Resolve the pnpm invocation that mirrors how the console itself was started. */
function pnpmInvocation(script: string): { command: string; args: string[]; shell: boolean } {
  const entrypoint = process.env.npm_execpath
  if (entrypoint !== undefined && entrypoint !== '') {
    if (/\.[cm]?js$/iu.test(entrypoint)) {
      return { command: process.execPath, args: [entrypoint, 'run', script], shell: false }
    }
    return { command: entrypoint, args: ['run', script], shell: false }
  }
  if (process.platform === 'win32') {
    return { command: `pnpm run ${quoteArgument(script)}`, args: [], shell: true }
  }
  return { command: 'pnpm', args: ['run', script], shell: false }
}

/** Kill one child and every process it spawned. */
function killTree(child: ChildProcess): void {
  const pid = child.pid
  if (pid === undefined) {
    child.kill('SIGKILL')
    return
  }
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    killer.once('close', (code) => {
      if (code !== 0) child.kill('SIGKILL')
    })
    killer.once('error', () => {
      child.kill('SIGKILL')
    })
    killer.unref()
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  }
  catch {
    child.kill('SIGKILL')
  }
}

/**
 * Build the runner for one repository.
 * @param options - repository root, timeout, and output cap.
 * @returns a runner whose state belongs to the caller's console instance.
 */
export function createGateRunner(options: GateRunnerOptions): GateRunner {
  const runs = new Map<string, GateRun>()
  let active: ActiveRun | undefined

  /** Drop the oldest settled runs once the history cap is exceeded. */
  function trim(): void {
    for (const [id, run] of runs) {
      if (runs.size <= MAX_RUN_HISTORY) return
      if (run.status === 'running') continue
      runs.delete(id)
    }
  }

  /** Append one chunk under the per-stream byte cap. */
  function append(run: GateRun, stream: 'stdout' | 'stderr', chunk: Buffer): void {
    const current = Buffer.from(run[stream], 'utf8')
    const remaining = options.outputBytes - current.length
    if (remaining <= 0) {
      run.truncated = true
      return
    }
    run[stream] += chunk.subarray(0, remaining).toString('utf8')
    if (chunk.length > remaining) run.truncated = true
  }

  return {
    get activeScript(): string | undefined {
      return active?.run.script
    },

    start(gate: GateInsight): GateRun {
      if (active !== undefined) throw new GateRunConflictError()

      const run: GateRun = {
        id: randomUUID(),
        script: gate.script,
        command: gate.command,
        status: 'running',
        startedAt: new Date().toISOString(),
        exitCode: null,
        stdout: '',
        stderr: '',
        truncated: false,
      }
      runs.set(run.id, run)
      trim()

      const startedAtMs = Date.now()
      let resolveDone: () => void = () => {}
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve
      })
      let settled = false
      let timedOut = false
      let timer: NodeJS.Timeout | undefined
      let forceTimer: NodeJS.Timeout | undefined

      /** Finalize the run exactly once. */
      const finish = (status: GateRunStatus, exitCode: number | null): void => {
        if (settled) return
        settled = true
        if (timer !== undefined) clearTimeout(timer)
        if (forceTimer !== undefined) clearTimeout(forceTimer)
        run.status = status
        run.exitCode = exitCode
        run.finishedAt = new Date().toISOString()
        run.durationMs = Date.now() - startedAtMs
        active = undefined
        resolveDone()
        trim()
      }

      const invocation = pnpmInvocation(gate.script)
      let child: ChildProcess
      try {
        child = spawn(invocation.command, invocation.args, {
          cwd: options.repoRoot,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: invocation.shell,
          detached: process.platform !== 'win32',
          windowsHide: true,
        })
      }
      catch (error) {
        run.stderr = error instanceof Error ? error.message : String(error)
        finish('error', null)
        return run
      }

      active = { run, child, done }
      child.stdout?.on('data', (chunk: Buffer) => {
        append(run, 'stdout', chunk)
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        append(run, 'stderr', chunk)
      })
      child.once('error', (error) => {
        run.stderr += `\n${error.message}`
        finish('error', null)
      })
      child.once('exit', (code) => {
        if (timedOut) finish('timeout', code)
      })
      child.once('close', (code) => {
        finish(timedOut ? 'timeout' : code === 0 ? 'success' : 'failed', code)
      })
      timer = setTimeout(() => {
        timedOut = true
        killTree(child)
        // `close` waits for every pipe holder to exit. A failed tree kill can
        // leave a grandchild holding them, so retry and settle regardless.
        forceTimer = setTimeout(() => {
          killTree(child)
          finish('timeout', null)
        }, 2000)
      }, options.timeoutMs)

      return run
    },

    get(id: string): GateRun | undefined {
      return runs.get(id)
    },

    list(): readonly GateRun[] {
      return [...runs.values()].reverse()
    },

    async stopAll(): Promise<void> {
      const current = active
      if (current === undefined) return
      killTree(current.child)
      await Promise.race([
        current.done,
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 5000)
          timer.unref()
        }),
      ])
    },
  }
}
