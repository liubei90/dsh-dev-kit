// Users repository: all SQL touching the users table lives here. Emails are
// normalized by the shared validator before reaching this layer; the unique
// index violation surfaces as the EMAIL_TAKEN API error.

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { PublicUser, UserId } from '@devkit/shared'
import { ApiError } from '../errors.js'

interface UserRow {
  id: string
  email: string
  password_hash: string
  created_at: string
}

/** A user record plus the hash needed only by login verification. */
export interface UserRecord {
  user: PublicUser
  passwordHash: string
}

export interface UsersRepo {
  create(email: string, passwordHash: string): PublicUser
  findByEmail(email: string): UserRecord | null
  findById(id: UserId): UserRecord | null
}

function rowToPublic(row: UserRow): PublicUser {
  return { id: row.id as UserId, email: row.email, createdAt: row.created_at }
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('SQLITE_CONSTRAINT')
  )
}

export function createUsersRepo(db: Database.Database): UsersRepo {
  const insert = db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (@id, @email, @passwordHash, @createdAt)',
  )
  const selectByEmail = db.prepare('SELECT * FROM users WHERE email = ?')
  const selectById = db.prepare('SELECT * FROM users WHERE id = ?')

  function toRecord(row: UserRow): UserRecord {
    return { user: rowToPublic(row), passwordHash: row.password_hash }
  }

  return {
    create(email, passwordHash) {
      const id = randomUUID()
      const createdAt = new Date().toISOString()
      try {
        insert.run({ id, email, passwordHash, createdAt })
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'EMAIL_TAKEN', 'email is already registered')
        }
        throw error
      }
      return { id: id as UserId, email, createdAt }
    },
    findByEmail(email) {
      const row = selectByEmail.get(email) as UserRow | undefined
      return row ? toRecord(row) : null
    },
    findById(id) {
      const row = selectById.get(id) as UserRow | undefined
      return row ? toRecord(row) : null
    },
  }
}
