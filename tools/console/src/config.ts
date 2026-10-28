/**
 * Console runtime constants and environment parsing. The host is fixed to the
 * loopback interface; only the port, repository root, and gate timeout are
 * deployment-tunable.
 */

import { resolve } from 'node:path'

/** Reserved URL prefix owned by the console. */
export const CONSOLE_BASE_PATH = '/_console'

/** Interface the console binds; never configurable. */
export const CONSOLE_HOST = '127.0.0.1'

/** Default port; chosen away from the common 3000 and 5173 business ports. */
export const DEFAULT_CONSOLE_PORT = 4310

/** Default per-gate timeout. */
export const DEFAULT_GATE_TIMEOUT_MS = 300_000

/** Maximum bytes kept from each gate output stream. */
export const MAX_GATE_OUTPUT_BYTES = 256 * 1024

/** Maximum accepted request body size. */
export const MAX_REQUEST_BODY_BYTES = 64 * 1024

/** Number of recent gate runs kept in memory. */
export const MAX_RUN_HISTORY = 20

/**
 * Repository root when no override is given: `tools/console/src` sits three
 * levels below the repository root.
 * @returns the absolute default root.
 */
export function defaultRepoRoot(): string {
  return resolve(import.meta.dirname, '../../..')
}

/** Parse one positive integer environment value, failing fast on bad input. */
function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  variable: string,
  maximum?: number,
): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || String(parsed) !== value) {
    throw new Error(`${variable} must be a positive integer, got ${JSON.stringify(value)}`)
  }
  if (maximum !== undefined && parsed > maximum) {
    throw new Error(`${variable} must be at most ${String(maximum)}, got ${JSON.stringify(value)}`)
  }
  return parsed
}

/**
 * Read the console port.
 * @param env - environment holding `DEVKIT_CONSOLE_PORT`.
 * @returns the configured port, or the default.
 */
export function readConsolePort(env: NodeJS.ProcessEnv = process.env): number {
  return readPositiveInteger(env.DEVKIT_CONSOLE_PORT, DEFAULT_CONSOLE_PORT, 'DEVKIT_CONSOLE_PORT', 65_535)
}

/**
 * Read the per-gate timeout.
 * @param env - environment holding `DEVKIT_CONSOLE_GATE_TIMEOUT_MS`.
 * @returns the timeout in milliseconds.
 */
export function readGateTimeout(env: NodeJS.ProcessEnv = process.env): number {
  return readPositiveInteger(env.DEVKIT_CONSOLE_GATE_TIMEOUT_MS, DEFAULT_GATE_TIMEOUT_MS, 'DEVKIT_CONSOLE_GATE_TIMEOUT_MS')
}

/**
 * Read the repository root override.
 * @param env - environment holding `DEVKIT_CONSOLE_REPO_ROOT`.
 * @returns the configured root, or the directory three levels above this module.
 */
export function readRepoRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.DEVKIT_CONSOLE_REPO_ROOT
  return configured === undefined || configured === '' ? defaultRepoRoot() : resolve(configured)
}
