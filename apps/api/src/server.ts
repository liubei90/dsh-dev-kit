// Fastify server factory: opens the database, runs migrations, registers the
// JWT plugin and auth routes, and normalizes every error into the shared
// ApiEnvelope. Tests build an app from an injected AppConfig and drive it
// over real HTTP via app.inject.

import Fastify, { type FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import type { AppConfig } from './config.js'
import { openDatabase, runMigrations } from './db/database.js'
import { createUsersRepo } from './db/users.js'
import authRoutes from './routes/auth.js'
import { ApiError } from './errors.js'

export async function createServer(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.logger })

  // Error and not-found handlers must be set before plugin registration:
  // encapsulated plugin contexts inherit them only when they already exist.
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      ok: false,
      error: { code: 'NOT_FOUND', message: `${request.method} ${request.url} not found` },
    })
  })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      if (error.status >= 500) {
        request.log.error({ err: error }, 'api error')
      }
      return reply.code(error.status).send({
        ok: false,
        error: { code: error.code, message: error.message },
      })
    }
    request.log.error({ err: error }, 'unhandled error')
    return reply.code(500).send({
      ok: false,
      error: { code: 'INTERNAL', message: 'internal server error' },
    })
  })

  const db = openDatabase(config.databasePath)
  runMigrations(db)
  const users = createUsersRepo(db)

  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: config.jwtTtl } })
  await app.register(authRoutes, { users })

  app.addHook('onClose', (_instance, done) => {
    db.close()
    done()
  })

  return app
}
