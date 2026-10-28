/**
 * The console HTTP server: `node:http` routing under `/_console`, server-rendered
 * HTML pages, a small JSON API, static assets, and gate run endpoints. The
 * server binds the loopback interface only and accepts gate runs from the
 * catalog alone.
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GateRun } from '@devkit/repo'
import { readGates, readGraph, readHealth } from '@devkit/repo/readers'
import {
  CONSOLE_BASE_PATH,
  CONSOLE_HOST,
  MAX_GATE_OUTPUT_BYTES,
  MAX_REQUEST_BODY_BYTES,
  readConsolePort,
  readGateTimeout,
  readRepoRoot,
} from './config.js'
import { createGateRunner, GateRunConflictError, type GateRunner } from './gates/runner.js'
import { fail, ok, sendAsset, sendHtml, sendJson, sendRedirect } from './http.js'
import { t } from './i18n/zh-CN.js'
import { renderGateRunPage, renderGatesPage } from './render/gates.js'
import { renderGraphPage } from './render/graph.js'
import { parseHealthTab, renderHealthPage } from './render/health.js'
import { renderErrorPage } from './render/layout.js'

/** Options for one console instance. */
export interface ConsoleOptions {
  /** Repository root; defaults to `DEVKIT_CONSOLE_REPO_ROOT` or the checkout root. */
  readonly repoRoot?: string
  /** Port; 0 lets the system choose one. */
  readonly port?: number
  /** Per-gate timeout in milliseconds. */
  readonly gateTimeoutMs?: number
  /** Bytes kept from each gate output stream. */
  readonly gateOutputBytes?: number
  /** Set to false to silence request logging, as tests do. */
  readonly log?: boolean
}

/** A running console; `close` is idempotent and releases the run's processes. */
export interface ConsoleHandle {
  /** Start listening and return the base URL. */
  listen(): Promise<string>
  /** Stop listening and kill any active gate run. */
  close(): Promise<void>
}

/** One static asset loaded at startup. */
interface ConsoleAsset {
  readonly body: string
  readonly contentType: string
}

/** Static routes under the console prefix. */
const ASSET_FILES: Readonly<Record<string, { readonly file: string; readonly contentType: string }>> = {
  [`${CONSOLE_BASE_PATH}/assets/styles.css`]: { file: 'styles.css', contentType: 'text/css; charset=utf-8' },
  [`${CONSOLE_BASE_PATH}/assets/console.js`]: { file: 'console.js', contentType: 'text/javascript; charset=utf-8' },
}

/** Hostnames accepted in the `Host` header. */
const TRUSTED_HOSTNAMES: readonly string[] = ['127.0.0.1', 'localhost', '[::1]']

/** One HTTP failure that maps to a stable status and error code. */
class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly allow: string | undefined

  constructor(status: number, code: string, message: string, allow?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.allow = allow
  }
}

/** Load the stylesheet and enhancement script into memory. */
function loadAssets(): Map<string, ConsoleAsset> {
  const assets = new Map<string, ConsoleAsset>()
  for (const [route, meta] of Object.entries(ASSET_FILES)) {
    const absolute = fileURLToPath(new URL(`./assets/${meta.file}`, import.meta.url))
    assets.set(route, { body: readFileSync(absolute, 'utf8'), contentType: meta.contentType })
  }
  return assets
}

/** Read the hostname from one Host header. */
function hostnameOf(host: string): string | undefined {
  try {
    return new URL(`http://${host}`).hostname
  }
  catch {
    return undefined
  }
}

/** Reject requests addressed to another host and cross-site mutations. */
function assertTrustedRequest(request: IncomingMessage): void {
  const host = request.headers.host
  if (host === undefined) throw new HttpError(403, 'FORBIDDEN', t('error.forbidden'))
  const hostname = hostnameOf(host)
  if (hostname === undefined || !TRUSTED_HOSTNAMES.includes(hostname)) {
    throw new HttpError(403, 'FORBIDDEN', t('error.forbidden'))
  }
  if (request.method !== 'POST') return

  const origin = request.headers.origin
  if (origin !== undefined) {
    let originHost: string | undefined
    try {
      originHost = new URL(origin).host
    }
    catch {
      originHost = undefined
    }
    if (originHost !== host) throw new HttpError(403, 'FORBIDDEN', t('error.forbidden'))
  }
  const site = request.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') {
    throw new HttpError(403, 'FORBIDDEN', t('error.forbidden'))
  }
}

/** Consume and bound one request body. */
async function drainBody(request: IncomingMessage): Promise<void> {
  const declared = Number.parseInt(request.headers['content-length'] ?? '', 10)
  if (Number.isSafeInteger(declared) && declared > MAX_REQUEST_BODY_BYTES) {
    throw new HttpError(413, 'VALIDATION', t('error.invalid'))
  }
  let size = 0
  for await (const chunk of request) {
    size += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), 'utf8')
    if (size > MAX_REQUEST_BODY_BYTES) throw new HttpError(413, 'VALIDATION', t('error.invalid'))
  }
}

/** Reject one request whose method is not the route's method. */
function assertMethod(request: IncomingMessage, method: 'GET' | 'POST'): void {
  if (request.method !== method) {
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', t('error.method'), method)
  }
}

/** Read one path segment as a script name. */
function decodeScript(segment: string): string {
  try {
    return decodeURIComponent(segment)
  }
  catch {
    throw new HttpError(400, 'VALIDATION', t('error.invalid'))
  }
}

/**
 * Build one console instance.
 * @param options - repository root, port, gate limits, and logging.
 * @returns a handle that owns the HTTP server and the gate runner.
 */
export function createConsole(options: ConsoleOptions = {}): ConsoleHandle {
  const repoRoot = resolve(options.repoRoot ?? readRepoRoot())
  const port = options.port ?? readConsolePort()
  const timeoutMs = options.gateTimeoutMs ?? readGateTimeout()
  const outputBytes = options.gateOutputBytes ?? MAX_GATE_OUTPUT_BYTES
  const log = options.log !== false
  const runner: GateRunner = createGateRunner({ repoRoot, timeoutMs, outputBytes })
  const assets = loadAssets()
  let listening = false
  let closed = false

  /** Look up a catalog gate and start it, mapping known failures. */
  function startRun(script: string): GateRun {
    const gate = readGates(repoRoot).find(candidate => candidate.script === script)
    if (gate === undefined) throw new HttpError(404, 'NOT_FOUND', t('error.runMissing'))
    try {
      return runner.start(gate)
    }
    catch (error) {
      if (error instanceof GateRunConflictError) throw new HttpError(409, 'CONFLICT', t('error.busy'))
      throw error
    }
  }

  /** Route one already-trusted request. */
  async function route(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    const { pathname, searchParams } = url

    const asset = assets.get(pathname)
    if (asset !== undefined) {
      assertMethod(request, 'GET')
      sendAsset(response, 200, asset.body, asset.contentType)
      return
    }
    if (pathname.startsWith(`${CONSOLE_BASE_PATH}/assets/`)) {
      throw new HttpError(404, 'NOT_FOUND', t('error.notFound'))
    }

    if (pathname === CONSOLE_BASE_PATH) {
      assertMethod(request, 'GET')
      const health = readHealth(repoRoot)
      sendHtml(response, 200, renderHealthPage({
        health,
        tab: parseHealthTab(searchParams.get('tab')),
        search: searchParams,
      }))
      return
    }

    if (pathname === `${CONSOLE_BASE_PATH}/graph`) {
      assertMethod(request, 'GET')
      const graph = readGraph(repoRoot)
      const selectedId = searchParams.get('node')
      const selected = graph.nodes.find(node => node.id === selectedId)
      const selectedContent = selected === undefined
        ? undefined
        : readFileSync(resolve(repoRoot, selected.id), 'utf8')
      sendHtml(response, 200, renderGraphPage({
        graph,
        search: searchParams,
        ...(selectedContent === undefined ? {} : { selectedContent }),
      }))
      return
    }

    if (pathname === `${CONSOLE_BASE_PATH}/gates`) {
      assertMethod(request, 'GET')
      sendHtml(response, 200, renderGatesPage({ gates: readGates(repoRoot), runs: runner.list() }))
      return
    }

    const runPage = /^\/_console\/gates\/runs\/([^/]+)$/u.exec(pathname)
    if (runPage !== null) {
      assertMethod(request, 'GET')
      const run = runner.get(decodeScript(runPage[1] ?? ''))
      if (run === undefined) throw new HttpError(404, 'NOT_FOUND', t('error.runMissing'))
      sendHtml(response, 200, renderGateRunPage({ run }))
      return
    }

    const startPage = /^\/_console\/gates\/([^/]+)\/run$/u.exec(pathname)
    if (startPage !== null) {
      assertMethod(request, 'POST')
      await drainBody(request)
      const run = startRun(decodeScript(startPage[1] ?? ''))
      sendRedirect(response, `${CONSOLE_BASE_PATH}/gates/runs/${run.id}`)
      return
    }

    if (pathname === `${CONSOLE_BASE_PATH}/api/health`) {
      assertMethod(request, 'GET')
      sendJson(response, 200, ok(readHealth(repoRoot)))
      return
    }

    if (pathname === `${CONSOLE_BASE_PATH}/api/graph`) {
      assertMethod(request, 'GET')
      sendJson(response, 200, ok(readGraph(repoRoot)))
      return
    }

    if (pathname === `${CONSOLE_BASE_PATH}/api/gates`) {
      assertMethod(request, 'GET')
      sendJson(response, 200, ok({ gates: readGates(repoRoot), runs: runner.list() }))
      return
    }

    const apiRunPage = /^\/_console\/api\/gates\/runs\/([^/]+)$/u.exec(pathname)
    if (apiRunPage !== null) {
      assertMethod(request, 'GET')
      const run = runner.get(decodeScript(apiRunPage[1] ?? ''))
      if (run === undefined) throw new HttpError(404, 'NOT_FOUND', t('error.runMissing'))
      sendJson(response, 200, ok(run))
      return
    }

    const apiStart = /^\/_console\/api\/gates\/([^/]+)\/runs$/u.exec(pathname)
    if (apiStart !== null) {
      assertMethod(request, 'POST')
      await drainBody(request)
      const run = startRun(decodeScript(apiStart[1] ?? ''))
      sendJson(response, 202, ok(run), { Location: `${CONSOLE_BASE_PATH}/api/gates/runs/${run.id}` })
      return
    }

    throw new HttpError(404, 'NOT_FOUND', pathname === '/' ? t('error.consoleHint') : t('error.notFound'))
  }

  /** Handle one request with trust checks, error mapping, and one log line. */
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestId = randomUUID()
    const started = Date.now()
    const url = new URL(request.url ?? '/', `http://${CONSOLE_HOST}`)
    let status = 500
    try {
      assertTrustedRequest(request)
      await route(request, response, url)
      status = response.statusCode
    }
    catch (error) {
      const known = error instanceof HttpError ? error : undefined
      status = known?.status ?? 500
      const message = known?.message ?? (error instanceof Error ? error.message : t('error.internal'))
      if (known === undefined) {
        process.stderr.write(`[console] ${requestId} unhandled: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
      }
      if (!response.headersSent) {
        if (known?.allow !== undefined) response.setHeader('Allow', known.allow)
        if (url.pathname.startsWith(`${CONSOLE_BASE_PATH}/api/`)) {
          sendJson(response, status, fail(known?.code ?? 'INTERNAL', message))
        }
        else {
          sendHtml(response, status, renderErrorPage(status, message))
        }
      }
      else {
        status = response.statusCode
        response.destroy()
      }
    }
    finally {
      if (log) {
        process.stdout.write(`[console] ${requestId} ${request.method ?? '?'} ${url.pathname} ${String(status)} ${String(Date.now() - started)}ms\n`)
      }
    }
  }

  const server = createHttpServer((request, response) => {
    void handle(request, response)
  })

  return {
    async listen(): Promise<string> {
      if (closed) throw new Error('console is closed')
      if (listening) throw new Error('console is already listening')
      await new Promise<void>((resolveListen, rejectListen) => {
        const onError = (error: Error): void => {
          server.off('listening', onListening)
          rejectListen(error)
        }
        const onListening = (): void => {
          server.off('error', onError)
          resolveListen()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, CONSOLE_HOST)
      })
      listening = true
      const address = server.address()
      if (address === null || typeof address === 'string') {
        throw new Error('console did not bind to a TCP address')
      }
      return `http://${CONSOLE_HOST}:${String(address.port)}`
    },

    async close(): Promise<void> {
      if (closed) return
      closed = true
      if (!listening) {
        await runner.stopAll()
        return
      }
      const closing = new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) rejectClose(error)
          else resolveClose()
        })
      })
      server.closeAllConnections()
      await runner.stopAll()
      await closing
    },
  }
}

const entrypoint = process.argv[1]
if (entrypoint !== undefined && resolve(entrypoint) === fileURLToPath(import.meta.url)) {
  try {
    const consoleHandle = createConsole()
    const url = await consoleHandle.listen()
    process.stdout.write(`[console] listening on ${url}${CONSOLE_BASE_PATH}\n`)

    let stopping = false
    const stop = (): void => {
      if (stopping) return
      stopping = true
      void consoleHandle.close().then(
        () => {
          process.exit(0)
        },
        (error: unknown) => {
          process.stderr.write(`[console] shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`)
          process.exit(1)
        },
      )
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  }
  catch (error) {
    process.stderr.write(`[console] failed to start: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
