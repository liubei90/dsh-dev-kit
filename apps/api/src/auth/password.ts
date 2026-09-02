// Password hashing with Node's built-in crypto.scrypt. Stored hashes are
// self-describing (`scrypt$N$r$p$<salt b64>$<hash b64>`) so parameters can
// change later without invalidating existing rows; verification uses
// timingSafeEqual and returns false for any malformed stored value.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 } as const
const SALT_LENGTH = 16
const KEY_LENGTH = 64

interface ScryptParams {
  N: number
  r: number
  p: number
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  params: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, params, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const { N, r, p } = DEFAULT_PARAMS
  const derived = await scryptAsync(password, salt, KEY_LENGTH, DEFAULT_PARAMS)
  return ['scrypt', N, r, p, salt.toString('base64'), derived.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return false
  const salt = Buffer.from(parts[4] ?? '', 'base64')
  const expected = Buffer.from(parts[5] ?? '', 'base64')
  if (salt.length === 0 || expected.length === 0) return false
  const derived = await scryptAsync(password, salt, expected.length, { N, r, p })
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
