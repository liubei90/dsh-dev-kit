import { describe, expect, it } from 'vitest'
import {
  isValidEmail,
  normalizeEmail,
  validateCredentials,
} from '../src/index.js'

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases the whole address', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })
})

describe('isValidEmail', () => {
  it('accepts a plain local@domain.tld address', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })
  it('rejects missing domain, whitespace, and empty strings', () => {
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('user example.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('validateCredentials', () => {
  it('accepts a valid email and password of at least 8 characters', () => {
    const result = validateCredentials({ email: ' A@B.com ', password: '12345678' })
    expect(result).toEqual({ ok: true, email: 'a@b.com' })
  })
  it('returns EMAIL_INVALID for a malformed email', () => {
    const result = validateCredentials({ email: 'nope', password: '12345678' })
    expect(result).toEqual({ ok: false, code: 'EMAIL_INVALID' })
  })
  it('returns PASSWORD_TOO_SHORT for a short password even with a valid email', () => {
    const result = validateCredentials({ email: 'a@b.com', password: 'short' })
    expect(result).toEqual({ ok: false, code: 'PASSWORD_TOO_SHORT' })
  })
})
