import { describe, expect, it } from 'vitest'
import type { ApiEnvelope } from '../src/index.js'

describe('ApiEnvelope', () => {
  it('discriminates ok and error branches', () => {
    const ok: ApiEnvelope<string> = { ok: true, data: 'hello' }
    const err: ApiEnvelope<string> = { ok: false, error: { code: 'E1', message: 'boom' } }
    expect(ok.ok).toBe(true)
    expect(err.ok).toBe(false)
  })
})
