import { describe, expect, it } from 'vitest'
import { isFixInvocation, resolveOxlintInvocation } from './run-oxlint.ts'

describe('Oxlint invocation', () => {
  it('keeps Oxlint\'s own worker default in CI', () => {
    expect(resolveOxlintInvocation(['.'], { CI: 'true', PATH: '/bin' }, 256)).toEqual({
      args: ['.', '--format=default'],
      env: { CI: 'true', PATH: '/bin' },
    })
  })

  it('bounds local invocations by the local worker budget', () => {
    expect(resolveOxlintInvocation(['.'], { PATH: '/bin' }, 256)).toEqual({
      args: ['.', '--threads=12'],
      env: { PATH: '/bin', GOMAXPROCS: '12' },
    })
    expect(resolveOxlintInvocation(['.'], {}, 4).args).toEqual(['.', '--threads=4'])
  })

  it('passes a caller\'s own worker bound through without the environment setting', () => {
    expect(resolveOxlintInvocation(['.', '--threads=2'], { PATH: '/bin' }, 256)).toEqual({
      args: ['.', '--threads=2'],
      env: { PATH: '/bin' },
    })
  })

  it('bounds both worker pools from one setting', () => {
    expect(resolveOxlintInvocation(['.', '--fix'], { OXLINT_THREADS: '4', GOMAXPROCS: '12' })).toEqual({
      args: ['.', '--fix', '--threads=4'],
      env: { OXLINT_THREADS: '4', GOMAXPROCS: '4' },
    })
  })

  it('lets the explicit worker bound win in CI', () => {
    expect(resolveOxlintInvocation(['.'], { CI: 'true', OXLINT_THREADS: '4' }, 256)).toEqual({
      args: ['.', '--format=default', '--threads=4'],
      env: { CI: 'true', OXLINT_THREADS: '4', GOMAXPROCS: '4' },
    })
  })

  it('does not mutate the caller argument list', () => {
    const args = ['.']
    resolveOxlintInvocation(args, {})
    expect(args).toEqual(['.'])
  })

  it('uses location-preserving diagnostics in CI', () => {
    expect(resolveOxlintInvocation(['.'], { CI: 'true' })).toEqual({
      args: ['.', '--format=default'],
      env: { CI: 'true' },
    })
  })

  it('preserves an explicitly selected CI formatter', () => {
    expect(resolveOxlintInvocation(['.', '--format', 'github'], { CI: 'true' }).args)
      .toEqual(['.', '--format', 'github'])
  })

  it('preserves an explicitly selected short CI formatter', () => {
    expect(resolveOxlintInvocation(['.', '-f=json'], { CI: 'true' }).args)
      .toEqual(['.', '-f=json'])
  })

  it('detects every fix mode so the second pass runs', () => {
    expect(isFixInvocation(['.'])).toBe(false)
    expect(isFixInvocation(['.', '--fix'])).toBe(true)
    expect(isFixInvocation(['.', '--fix-dangerously'])).toBe(true)
    expect(isFixInvocation(['.', '--fix-suggestions'])).toBe(true)
  })

  it.each(['0', '-1', '1.5', 'auto'])('rejects invalid worker bound %s', (value) => {
    expect(() => resolveOxlintInvocation(['.'], { OXLINT_THREADS: value }))
      .toThrow('OXLINT_THREADS must be a positive integer')
  })

  it('rejects a competing direct worker bound', () => {
    expect(() => resolveOxlintInvocation(['.', '--threads=2'], { OXLINT_THREADS: '4' }))
      .toThrow('use OXLINT_THREADS instead')
  })
})
