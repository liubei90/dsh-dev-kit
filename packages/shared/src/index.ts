// Shared contract between apps/api and apps/web: the ApiEnvelope response
// shape, auth DTOs, error codes, and validation helpers. This module is the
// single source of truth for the wire contract; it has no runtime
// dependencies and is importable by both apps.

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

/** User id crossing the process boundary; branded per the root id rule. */
export type UserId = string & { readonly __brand: 'UserId' }

export const PASSWORD_MIN_LENGTH = 8

export const AUTH_ERROR_CODES = [
  'EMAIL_INVALID',
  'PASSWORD_TOO_SHORT',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'INTERNAL',
] as const

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number]

export interface RegisterInput {
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

/** User record safe to send across the wire; never carries the hash. */
export interface PublicUser {
  id: UserId
  email: string
  createdAt: string
}

export interface LoginResult {
  token: string
  user: PublicUser
}

/**
 * Normalize an email for storage and lookup: trim surrounding whitespace and
 * lowercase the whole address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Accepts the common shape `local@domain.tld` with no whitespace. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export type RegisterValidation =
  | { ok: true; email: string }
  | { ok: false; code: 'EMAIL_INVALID' | 'PASSWORD_TOO_SHORT' }

/** Validate a register/login payload and return the normalized email. */
export function validateCredentials(input: {
  email: string
  password: string
}): RegisterValidation {
  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) return { ok: false, code: 'EMAIL_INVALID' }
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, code: 'PASSWORD_TOO_SHORT' }
  }
  return { ok: true, email }
}
