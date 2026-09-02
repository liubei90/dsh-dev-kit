// Environment-driven configuration. Every tunable comes from env vars
// documented in .env.example; nothing is hardcoded at call sites. Module
// evaluation reads no env, so tests can inject a fixed AppConfig.

import { fileURLToPath } from 'node:url'

const DEFAULT_DATABASE_PATH = fileURLToPath(new URL('../data/dev.sqlite', import.meta.url))
const DEFAULT_PORT = 3000
const DEFAULT_JWT_TTL = '1h'

export interface AppConfig {
  /** SQLite file path, or ':memory:' for tests. */
  databasePath: string
  /** HS256 secret for @fastify/jwt; required outside tests. */
  jwtSecret: string
  /** Token expiry passed through to jsonwebtoken, e.g. '15m', '1h'. */
  jwtTtl: string
  port: number
  /** Enable the Fastify logger; request-scoped logs then carry the request id. */
  logger: boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const jwtSecret = env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set (see .env.example)')
  }
  const rawPort = env.PORT
  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got ${rawPort}`)
  }
  return {
    databasePath: env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
    jwtSecret,
    jwtTtl: env.JWT_TTL ?? DEFAULT_JWT_TTL,
    port,
    logger: true,
  }
}
