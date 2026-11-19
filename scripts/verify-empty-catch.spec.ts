/**
 * Unit tests for the empty-catch rule: naming the discarded error, explaining it, and keeping one
 * statement in the `try`.
 */

import { describe, expect, it } from 'vitest'
import { checkSource } from './verify-empty-catch.ts'

describe('checkSource', () => {
  it('accepts a named, explained clause whose try holds one statement', () => {
    const source = `async function clean(): Promise<void> {
  try {
    await unlink('tmp')
  } catch (error) {
    // The file is gone; nothing reads it.
    void error
  }
}
`
    expect(checkSource(source, 'sample.ts')).toEqual([])
  })

  it('rejects a clause without a binding', () => {
    const source = `try {
  await unlink('tmp')
} catch {
  // The file is gone.
}
`
    expect(checkSource(source, 'sample.ts')).toEqual([
      { file: 'sample.ts', line: 3, defects: ['unnamed'] },
    ])
  })

  it('rejects a clause without a reason comment', () => {
    const source = `try {
  await unlink('tmp')
} catch (_error) {}
`
    expect(checkSource(source, 'sample.ts')).toEqual([
      { file: 'sample.ts', line: 3, defects: ['unexplained'] },
    ])
  })

  it('rejects a try that holds more than one statement', () => {
    const source = `try {
  await unlink('tmp')
  registry.delete(id)
} catch (_error) {
  // Cleanup is best effort.
}
`
    expect(checkSource(source, 'sample.ts')).toEqual([
      { file: 'sample.ts', line: 4, defects: ['wide-try'] },
    ])
  })

  it('counts a compound statement as one statement', () => {
    const source = `try {
  if (present) await unlink('tmp')
} catch (_error) {
  // Nothing to clean.
}
`
    expect(checkSource(source, 'sample.ts')).toEqual([])
  })

  it('treats a clause with a body statement as out of scope', () => {
    const source = `try {
  statSync(child)
  registry.delete(id)
} catch {
  return false
}
`
    expect(checkSource(source, 'sample.ts')).toEqual([])
  })

  it('accepts a semicolon-only body with a reason and binding', () => {
    const source = `try {
  await unlink('tmp')
} catch (_error) {
  ;
  // Nothing reads the file.
}
`
    expect(checkSource(source, 'sample.ts')).toEqual([])
  })

  it('reports every broken condition on one clause', () => {
    const source = `try {
  a()
  b()
} catch {}
`
    expect(checkSource(source, 'sample.ts')).toEqual([
      { file: 'sample.ts', line: 4, defects: ['unnamed', 'unexplained', 'wide-try'] },
    ])
  })
})
