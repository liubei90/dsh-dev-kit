// E2E over the real API process: spawns the server entry on a free local
// port with a temp SQLite file, then drives register/login/me over real TCP
// with global fetch and asserts external state in the DB file. Needs no
// external credentials, so it runs whenever the e2e gate runs.

import { spawn } from 'node:child_process'
import { createServer as createNetServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'

const TSX_BIN = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url))
const API_ENTRY = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const EMAIL = `e2e-${Date.now()}@example.com`
const PASSWORD = 'password-123'

async function findFreePort(): Promise<number> {
  const server = createNetServer()
  server.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return port
}

async function waitForServer(baseUrl: string, child: { exitCode: number | null }, stderr: string[]): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`api exited early (code ${child.exitCode}): ${stderr.join('')}`)
    }
    try {
      await fetch(`${baseUrl}/auth/me`)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error('api did not become ready in time')
}

describe('auth e2e (real server process)', () => {
  let baseUrl: string
  let dataDir: string
  let dbFile: string
  let serverProcess: ReturnType<typeof spawn>
  let stderr: string[]

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'dsh-dev-kit-e2e-'))
    dbFile = join(dataDir, 'e2e.sqlite')
    const port = await findFreePort()
    baseUrl = `http://127.0.0.1:${port}`
    stderr = []
    serverProcess = spawn(TSX_BIN, [API_ENTRY], {
      env: {
        ...process.env,
        JWT_SECRET: 'e2e-only-secret',
        DATABASE_PATH: dbFile,
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    serverProcess.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()))
    await waitForServer(baseUrl, serverProcess, stderr)
  }, 15_000)

  afterAll(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill()
      await new Promise<void>((resolve) => serverProcess.once('exit', () => resolve()))
    }
    rmSync(dataDir, { recursive: true, force: true })
  })

  async function envelope<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...init,
    })
    const body = (await res.json()) as T
    return { status: res.status, body }
  }

  it('registers, logs in, and reads /auth/me over real TCP', async () => {
    const registered = await envelope<{ ok: true; data: { id: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    expect(registered.status).toBe(201)
    expect(registered.body.data.email).toBe(EMAIL)

    const db = new Database(dbFile, { readonly: true })
    try {
      const row = db.prepare('SELECT email FROM users WHERE email = ?').get(EMAIL) as { email: string } | undefined
      expect(row?.email).toBe(EMAIL)
    } finally {
      db.close()
    }

    const loggedIn = await envelope<{ ok: true; data: { token: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    expect(loggedIn.status).toBe(200)
    expect(loggedIn.body.data.token).toBeTruthy()

    const me = await envelope<{ ok: true; data: { user: { email: string } } }>('/auth/me', {
      headers: { authorization: `Bearer ${loggedIn.body.data.token}` },
    })
    expect(me.status).toBe(200)
    expect(me.body.data.user.email).toBe(EMAIL)
  })

  it('rejects an invalid login with the envelope over real TCP', async () => {
    const rejected = await envelope<{ ok: false; error: { code: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `nobody-${Date.now()}@example.com`, password: PASSWORD }),
    })
    expect(rejected.status).toBe(401)
    expect(rejected.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})
