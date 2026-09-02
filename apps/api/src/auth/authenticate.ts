// Auth guard factory: validates the Bearer JWT and loads the user, attaching
// it to the request. Any missing, expired, invalid, or orphaned token becomes
// the same UNAUTHORIZED envelope so clients have one failure path.

import type { FastifyRequest } from 'fastify'
import type { PublicUser, UserId } from '@devkit/shared'
import { ApiError } from '../errors.js'
import type { UsersRepo } from '../db/users.js'

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: PublicUser
  }
}

export function authenticate(users: UsersRepo) {
  return async (request: FastifyRequest): Promise<void> => {
    let payload: { sub?: unknown } | undefined
    try {
      payload = await request.jwtVerify<{ sub?: string }>()
    } catch {
      payload = undefined
    }
    const sub = payload?.sub
    if (typeof sub !== 'string' || sub.length === 0) {
      throw new ApiError(401, 'UNAUTHORIZED', 'missing, expired, or invalid token')
    }
    const record = users.findById(sub as UserId)
    if (!record) {
      throw new ApiError(401, 'UNAUTHORIZED', 'user no longer exists')
    }
    request.authUser = record.user
  }
}
