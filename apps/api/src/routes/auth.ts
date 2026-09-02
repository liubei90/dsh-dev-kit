// /auth routes: register, login, current user, logout. Handlers stay thin:
// validation comes from shared helpers, hashing and storage from the
// auth/db layers, and every response follows the shared ApiEnvelope.

import type { FastifyInstance } from 'fastify'
import { PASSWORD_MIN_LENGTH, validateCredentials, type LoginResult } from '@devkit/shared'
import { ApiError, ok } from '../errors.js'
import { authenticate } from '../auth/authenticate.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import type { UsersRepo } from '../db/users.js'

export interface AuthPluginOptions {
  users: UsersRepo
}

function parseCredentials(body: unknown): { email: string; password: string } {
  const record = (body ?? {}) as { email?: unknown; password?: unknown }
  return {
    email: typeof record.email === 'string' ? record.email : '',
    password: typeof record.password === 'string' ? record.password : '',
  }
}

function validationMessage(code: 'EMAIL_INVALID' | 'PASSWORD_TOO_SHORT'): string {
  return code === 'EMAIL_INVALID'
    ? 'email address is not valid'
    : `password must be at least ${PASSWORD_MIN_LENGTH} characters`
}

export default async function authRoutes(app: FastifyInstance, options: AuthPluginOptions): Promise<void> {
  const users = options.users
  const auth = authenticate(users)

  app.post('/auth/register', async (request, reply) => {
    const credentials = parseCredentials(request.body)
    const validation = validateCredentials(credentials)
    if (!validation.ok) {
      throw new ApiError(400, validation.code, validationMessage(validation.code))
    }
    const passwordHash = await hashPassword(credentials.password)
    const user = users.create(validation.email, passwordHash)
    return reply.code(201).send(ok(user))
  })

  app.post('/auth/login', async (request, reply) => {
    const credentials = parseCredentials(request.body)
    const validation = validateCredentials(credentials)
    const record = validation.ok ? users.findByEmail(validation.email) : null
    const valid =
      record !== null && (await verifyPassword(credentials.password, record.passwordHash))
    if (!valid) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'email or password is incorrect')
    }
    const token = app.jwt.sign({ sub: record!.user.id })
    const result: LoginResult = { token, user: record!.user }
    return reply.send(ok(result))
  })

  app.get('/auth/me', { preHandler: auth }, async (request) => {
    const user = request.authUser
    if (!user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'missing, expired, or invalid token')
    }
    return ok({ user })
  })

  // With a stateless JWT, logout is client-side token discard; the endpoint
  // exists to document that contract and returns 204 with no body.
  app.post('/auth/logout', async (_request, reply) => {
    return reply.code(204).send()
  })
}
