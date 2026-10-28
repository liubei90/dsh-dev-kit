import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { globToRegExp } from '@devkit/repo/readers'
import { inspectAssetOwnership, ownershipPattern } from './verify-asset-ownership.ts'

const cleanups: Array<() => void> = []

afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup()
  cleanups.length = 0
})

/** Create one temporary repository and register its cleanup. */
function tempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'asset-ownership-'))
  cleanups.push(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  })
  return root
}

/** Write one file below a temporary repository. */
function writeFile(root: string, path: string, content: string): void {
  const absolute = join(root, path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, content, 'utf8')
}

const VALID_MANIFEST = {
  version: 1,
  default: 'project',
  rules: [
    { category: 'framework', patterns: ['docs/asset-ownership.json', 'scripts/**/*.ts'] },
    { category: 'mixed', patterns: ['AGENTS.md'] },
  ],
}

/** Write the minimal repository the valid manifest classifies. */
function writeValidRepository(root: string): void {
  writeFile(root, 'docs/asset-ownership.json', JSON.stringify(VALID_MANIFEST, null, 2))
  writeFile(root, 'scripts/check.ts', 'export {}\n')
  writeFile(root, 'AGENTS.md', '# 代理\n')
  writeFile(root, 'README.md', '# 项目\n')
}

describe('ownershipPattern', () => {
  it('agrees with the reader package on representative patterns', () => {
    const patterns = [
      'scripts/**/*.ts',
      '.agents/notes/**/AGENTS.md',
      'docs/**',
      'tsconfig*.json',
      '**/*.md',
      'tools/**',
    ]
    const paths = [
      'scripts/check.ts',
      'scripts/nested/check.ts',
      'scripts/doc-budgets.manifest.json',
      '.agents/notes/AGENTS.md',
      '.agents/notes/implemented/AGENTS.md',
      '.agents/skills/demo/SKILL.md',
      'docs/AGENTS.md',
      'docs/guides/testing.md',
      'tsconfig.base.json',
      'README.md',
      'tools/console/src/server.ts',
    ]
    for (const pattern of patterns) {
      for (const path of paths) {
        expect({ pattern, path, matches: ownershipPattern(pattern).test(path) })
          .toEqual({ pattern, path, matches: globToRegExp(pattern).test(path) })
      }
    }
  })
})

describe('inspectAssetOwnership', () => {
  it('accepts a manifest whose patterns all classify existing files', () => {
    const root = tempRepo()
    writeValidRepository(root)
    const report = inspectAssetOwnership(root)
    expect(report.errors).toEqual([])
    expect(report.files).toBe(4)
    expect(report.counts).toEqual({ framework: 2, mixed: 1, project: 1 })
  })

  it('rejects a pattern that matches no file', () => {
    const root = tempRepo()
    writeFile(root, 'docs/asset-ownership.json', JSON.stringify({
      version: 1,
      default: 'project',
      rules: [{ category: 'framework', patterns: ['docs/asset-ownership.json', 'docs/AGENTS.md'] }],
    }))
    const report = inspectAssetOwnership(root)
    expect(report.errors.some(error => error.includes('matches no file'))).toBe(true)
  })

  it('rejects a path claimed by two categories', () => {
    const root = tempRepo()
    writeFile(root, 'docs/asset-ownership.json', JSON.stringify({
      version: 1,
      default: 'project',
      rules: [
        { category: 'framework', patterns: ['docs/asset-ownership.json', 'docs/**'] },
        { category: 'mixed', patterns: ['docs/AGENTS.md'] },
      ],
    }))
    writeFile(root, 'docs/AGENTS.md', '# 文档标准\n')
    const report = inspectAssetOwnership(root)
    expect(report.errors.some(error => error.includes('claimed by multiple categories'))).toBe(true)
  })

  it('rejects an unsupported version', () => {
    const root = tempRepo()
    writeFile(root, 'docs/asset-ownership.json', JSON.stringify({ version: 2, default: 'project', rules: [] }))
    const report = inspectAssetOwnership(root)
    expect(report.errors.some(error => error.includes('version must be 1'))).toBe(true)
  })

  it('rejects duplicate patterns', () => {
    const root = tempRepo()
    writeFile(root, 'docs/asset-ownership.json', JSON.stringify({
      version: 1,
      default: 'project',
      rules: [
        { category: 'framework', patterns: ['docs/asset-ownership.json', 'README.md'] },
        { category: 'mixed', patterns: ['README.md'] },
      ],
    }))
    writeFile(root, 'README.md', '# 项目\n')
    const report = inspectAssetOwnership(root)
    expect(report.errors.some(error => error.includes('duplicate pattern'))).toBe(true)
  })

  it('rejects a manifest that does not classify itself as framework', () => {
    const root = tempRepo()
    writeFile(root, 'docs/asset-ownership.json', JSON.stringify({
      version: 1,
      default: 'project',
      rules: [{ category: 'mixed', patterns: ['README.md'] }],
    }))
    writeFile(root, 'README.md', '# 项目\n')
    const report = inspectAssetOwnership(root)
    expect(report.errors.some(error => error.includes('must classify itself as framework'))).toBe(true)
  })
})
