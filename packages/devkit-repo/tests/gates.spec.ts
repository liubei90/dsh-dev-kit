import { describe, expect, it } from 'vitest'
import { isGateScript, readGates } from '../src/gates.js'
import { createTempRepo } from './fixture.js'

describe('isGateScript', () => {
  it('accepts verify scripts and aggregate commands only', () => {
    expect(isGateScript('verify-md-links')).toBe(true)
    expect(isGateScript('doc-sync')).toBe(true)
    expect(isGateScript('test:coverage')).toBe(true)
    expect(isGateScript('dev')).toBe(false)
    expect(isGateScript('console')).toBe(false)
    expect(isGateScript('postinstall')).toBe(false)
  })
})

describe('readGates', () => {
  it('returns the catalog sorted by script name', () => {
    const repo = createTempRepo()
    try {
      repo.write('package.json', JSON.stringify({
        scripts: {
          build: 'tsc -b',
          console: 'tsx tools/console/src/server.ts',
          'verify-md-links': 'tsx scripts/verify-md-links.ts',
          'doc-sync': 'tsx scripts/run-gates.ts doc-sync',
          postinstall: 'node scripts/install-lefthook.mjs',
        },
      }))
      const gates = readGates(repo.root)
      expect(gates).toEqual([
        { script: 'build', command: 'tsc -b' },
        { script: 'doc-sync', command: 'tsx scripts/run-gates.ts doc-sync' },
        { script: 'verify-md-links', command: 'tsx scripts/verify-md-links.ts' },
      ])
    }
    finally {
      repo.cleanup()
    }
  })

  it('rejects a manifest without a scripts object', () => {
    const repo = createTempRepo()
    try {
      repo.write('package.json', JSON.stringify({ name: 'x' }))
      expect(() => readGates(repo.root)).toThrow(/scripts/u)
    }
    finally {
      repo.cleanup()
    }
  })
})
