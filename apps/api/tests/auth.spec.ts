// Auth API integration tests: real Fastify entry (app.inject) over a real
// SQLite engine (:memory:), covering the acceptance criteria in
// proposed/feature/2026-09-02-user-accounts-and-login.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { createServer } from '../src/server.js'
import type { AppConfig } from '../src/config.js'

const TEST_SECRET = 'test-secret-not-for-production'
const CREDENTIALS = { email: 'user@example.com', password: 'password-123' }

async function makeApp(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
  return createServer({
    databasePath: ':memory:',
    jwtSecret: TEST_SECRET,
    jwtTtl: '1h',
    port: 0,
    logger: false,
    ...overrides,
  })
}

function parseJson(response: LightMyRequestResponse): unknown {
  return JSON.parse(response.body) as unknown
}

describe('POST /auth/register', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    app = await makeApp()
  })
  afterEach(async () => {
    await app.close()
  })

  it('creates a user and returns the public envelope with 201', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: CREDENTIALS })
    expect(res.statusCode).toBe(201)
    const body = parseJson(res) as { ok: true; data: { id: string; email: string; createdAt: string } }
    expect(body.ok).toBe(true)
    expect(body.data.email).toBe('user@example.com')
    expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(typeof body.data.createdAt).toBe('string')
  })

  it('normalizes email whitespace and case before storing', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: '  USER@Example.COM ', password: 'password-123' },
    })
    expect(first.statusCode).toBe(201)
    const duplicate = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'user@example.com', password: 'password-123' },
    })
    expect(duplicate.statusCode).toBe(409)
    expect(parseJson(duplicate)).toMatchObject({ ok: false, error: { code: 'EMAIL_TAKEN' } })
  })

  it('returns 400 EMAIL_INVALID for a malformed email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'password-123' },
    })
    expect(res.statusCode).toBe(400)
    expect(parseJson(res)).toMatchObject({ ok: false, error: { code: 'EMAIL_INVALID' } })
  })

  it('returns 400 PASSWORD_TOO_SHORT for a short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'user@example.com', password: 'short' },
    })
    expect(res.statusCode).toBe(400)
    expect(parseJson(res)).toMatchObject({ ok: false, error: { code: 'PASSWORD_TOO_SHORT' } })
  })

  it('never leaks the password hash in the response', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: CREDENTIALS })
    expect(res.body).not.toContain('password_hash')
    expect(res.body).not.toContain('scrypt$')
  })
})

describe('POST /auth/login', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    app = await makeApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: CREDENTIALS })
  })
  afterEach(async () => {
    await app.close()
  })

  it('returns a token and the public user for valid credentials', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: CREDENTIALS })
    expect(res.statusCode).toBe(200)
    const body = parseJson(res) as {
      ok: true
      data: { token: string; user: { id: string; email: string } }
    }
    expect(body.data.token).toBeTruthy()
    expect(body.data.user.email).toBe('user@example.com')
    expect(res.body).not.toContain('scrypt$')
  })

  it('returns the identical 401 for unknown email and wrong password', async () => {
    const unknownEmail = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ghost@example.com', password: 'password-123' },
    })
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'user@example.com', password: 'wrong-password' },
    })
    expect(unknownEmail.statusCode).toBe(401)
    expect(wrongPassword.statusCode).toBe(401)
    expect(parseJson(unknownEmail)).toEqual(parseJson(wrongPassword))
    expect(parseJson(unknownEmail)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_CREDENTIALS' },
    })
  })

  it('accepts the email with different casing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'USER@Example.COM', password: 'password-123' },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /auth/me', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    app = await makeApp()
  })
  afterEach(async () => {
    await app.close()
  })

  async function tokenFor(email: string, password: string): Promise<string> {
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password } })
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    })
    const body = parseJson(login) as { ok: true; data: { token: string } }
    return body.data.token
  }

  it('returns the user for a valid Bearer token', async () => {
    const token = await tokenFor('user@example.com', 'password-123')
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(parseJson(res)).toMatchObject({
      ok: true,
      data: { user: { email: 'user@example.com' } },
    })
  })

  it('returns UNAUTHORIZED without, with a malformed, and with an expired token', async () => {
    const missing = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(missing.statusCode).toBe(401)
    expect(parseJson(missing)).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } })

    const malformed = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer not-a-jwt' },
    })
    expect(malformed.statusCode).toBe(401)
    expect(parseJson(malformed)).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } })

    const user = await app.inject({ method: 'POST', url: '/auth/register', payload: CREDENTIALS })
    const userId = (parseJson(user) as { ok: true; data: { id: string } }).data.id
    const expired = app.jwt.sign({ sub: userId }, { expiresIn: -1 })
    const expiredRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${expired}` },
    })
    expect(expiredRes.statusCode).toBe(401)
    expect(parseJson(expiredRes)).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } })
  })
})

describe('POST /auth/logout', () => {
  it('returns 204 with no body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'POST', url: '/auth/logout' })
      expect(res.statusCode).toBe(204)
      expect(res.body).toBe('')
    } finally {
      await app.close()
    }
  })
})

describe('full round trip', () => {
  it('register → login → me → logout keeps me authenticated (stateless semantics)', async () => {
    const app = await makeApp()
    try {
      await app.inject({ method: 'POST', url: '/auth/register', payload: CREDENTIALS })
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: CREDENTIALS })
      const token = (parseJson(login) as { ok: true; data: { token: string } }).data.token
      await app.inject({ method: 'POST', url: '/auth/logout' })
      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(me.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })
})
