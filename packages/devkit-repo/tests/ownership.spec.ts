import { describe, expect, it } from 'vitest'
import {
  createOwnershipResolver,
  globToRegExp,
  loadOwnershipManifest,
  normalizeRepoPath,
} from '../src/ownership.js'
import { createTempRepo } from './fixture.js'

describe('globToRegExp', () => {
  it('lets ** span directories and keeps * inside one segment', () => {
    expect(globToRegExp('docs/**').test('docs/architecture.md')).toBe(true)
    expect(globToRegExp('docs/**').test('docs/guides/testing.md')).toBe(true)
    expect(globToRegExp('docs/**').test('other/docs/a.md')).toBe(false)
    expect(globToRegExp('*.md').test('README.md')).toBe(true)
    expect(globToRegExp('*.md').test('docs/a.md')).toBe(false)
    expect(globToRegExp('tsconfig*.json').test('tsconfig.base.json')).toBe(true)
  })

  it('matches AGENTS files at any depth below the note tree', () => {
    const pattern = globToRegExp('.agents/notes/**/AGENTS.md')
    expect(pattern.test('.agents/notes/implemented/AGENTS.md')).toBe(true)
    expect(pattern.test('.agents/notes/AGENTS.md')).toBe(true)
    expect(pattern.test('.agents/skills/AGENTS.md')).toBe(false)
  })

  it('lets **/ match zero or more directories', () => {
    const pattern = globToRegExp('scripts/**/*.ts')
    expect(pattern.test('scripts/verify-md-links.ts')).toBe(true)
    expect(pattern.test('scripts/nested/verify.ts')).toBe(true)
    expect(pattern.test('scripts/doc-budgets.json')).toBe(false)
  })
})

describe('createOwnershipResolver', () => {
  const manifest = {
    version: 1 as const,
    default: 'project' as const,
    rules: [
      { category: 'mixed' as const, patterns: ['scripts/doc-budgets.manifest.json'] },
      { category: 'framework' as const, patterns: ['scripts/**', '.agents/skills/**'] },
    ],
  }

  it('applies the first matching rule and falls back to the default', () => {
    const resolver = createOwnershipResolver(manifest)
    expect(resolver.classify('scripts/doc-budgets.manifest.json')).toBe('mixed')
    expect(resolver.classify('scripts/verify-md-links.ts')).toBe('framework')
    expect(resolver.classify('apps/web/src/index.ts')).toBe('project')
  })

  it('normalizes separators before matching', () => {
    const resolver = createOwnershipResolver(manifest)
    expect(resolver.classify('.agents\\skills\\demo\\SKILL.md')).toBe('framework')
  })
})

describe('loadOwnershipManifest', () => {
  it('reads and validates the manifest', () => {
    const repo = createTempRepo()
    try {
      repo.write('docs/asset-ownership.json', JSON.stringify({
        version: 1,
        default: 'project',
        rules: [{ category: 'framework', patterns: ['scripts/**'] }],
      }))
      const manifest = loadOwnershipManifest(repo.root)
      expect(manifest.default).toBe('project')
      expect(manifest.rules).toHaveLength(1)
    }
    finally {
      repo.cleanup()
    }
  })

  it('rejects an unsupported version', () => {
    const repo = createTempRepo()
    try {
      repo.write('docs/asset-ownership.json', JSON.stringify({ version: 2, default: 'project', rules: [] }))
      expect(() => loadOwnershipManifest(repo.root)).toThrow(/asset-ownership\.json/u)
    }
    finally {
      repo.cleanup()
    }
  })
})

describe('normalizeRepoPath', () => {
  it('converts separators and removes a leading ./', () => {
    expect(normalizeRepoPath('./docs\\a.md')).toBe('docs/a.md')
  })
})
