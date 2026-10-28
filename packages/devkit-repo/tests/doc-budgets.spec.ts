import { describe, expect, it } from 'vitest'
import { countUnits, readDocBudgets } from '../src/doc-budgets.js'
import { createTempRepo } from './fixture.js'

describe('countUnits', () => {
  it('counts CJK characters plus whitespace-delimited tokens', () => {
    expect(countUnits('中文 abc')).toBe(3)
    expect(countUnits('中文，`code` 与 English words')).toBe(6)
    expect(countUnits('')).toBe(0)
  })
})

describe('readDocBudgets', () => {
  it('reads usage and sorts by pressure', () => {
    const repo = createTempRepo()
    try {
      repo.write('scripts/doc-budgets.manifest.json', JSON.stringify({ 'README.md': 10, 'docs/AGENTS.md': 100 }))
      repo.write('README.md', '中文 abc')
      repo.write('docs/AGENTS.md', '文档标准')

      const budgets = readDocBudgets(repo.root)
      expect(budgets[0]).toEqual({ path: 'README.md', used: 3, limit: 10 })
      expect(budgets[1]).toEqual({ path: 'docs/AGENTS.md', used: 4, limit: 100 })
    }
    finally {
      repo.cleanup()
    }
  })

  it('rejects a non-positive ceiling', () => {
    const repo = createTempRepo()
    try {
      repo.write('scripts/doc-budgets.manifest.json', JSON.stringify({ 'README.md': 0 }))
      repo.write('README.md', '')
      expect(() => readDocBudgets(repo.root)).toThrow(/positive integer ceiling/u)
    }
    finally {
      repo.cleanup()
    }
  })

  it('rejects a missing budgeted file', () => {
    const repo = createTempRepo()
    try {
      repo.write('scripts/doc-budgets.manifest.json', JSON.stringify({ 'README.md': 10 }))
      expect(() => readDocBudgets(repo.root)).toThrow()
    }
    finally {
      repo.cleanup()
    }
  })
})
