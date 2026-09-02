import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/auth/password.js'

describe('hashPassword / verifyPassword', () => {
  it('round-trips a correct password', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/)
    await expect(verifyPassword('correct horse battery staple', stored)).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('secret-a')
    await expect(verifyPassword('secret-b', stored)).resolves.toBe(false)
  })

  it('rejects a tampered stored hash', async () => {
    const stored = await hashPassword('secret-a')
    const tampered = stored.slice(0, -4) + (stored.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    await expect(verifyPassword('secret-a', tampered)).resolves.toBe(false)
  })

  it('rejects malformed stored values', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false)
    await expect(verifyPassword('x', 'scrypt$bad$1$1$!!$!!')).resolves.toBe(false)
  })

  it('produces distinct hashes for the same password (fresh salt)', async () => {
    const first = await hashPassword('same-password')
    const second = await hashPassword('same-password')
    expect(first).not.toBe(second)
  })
})
