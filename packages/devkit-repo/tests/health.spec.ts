import { describe, expect, it } from 'vitest'
import { readHealth } from '../src/health.js'
import { VALID_NOTE, createTempRepo } from './fixture.js'

describe('readHealth', () => {
  it('composes notes, skills, budgets, and gates', () => {
    const repo = createTempRepo()
    try {
      repo.write('package.json', JSON.stringify({
        scripts: {
          'doc-sync': 'tsx scripts/run-gates.ts doc-sync',
          'verify-md-links': 'tsx scripts/verify-md-links.ts',
          dev: 'tsx apps/api/src/index.ts',
        },
      }))
      repo.write('scripts/doc-budgets.manifest.json', JSON.stringify({ 'README.md': 100 }))
      repo.write('README.md', '项目说明')
      repo.write('.agents/notes/implemented/feature/2026-01-02-example.md', VALID_NOTE)
      repo.write('.agents/skills/demo/SKILL.md', '---\nname: demo\ndescription: 示例技能\n---\n\n# Demo\n')

      const health = readHealth(repo.root)
      expect(health.notes).toHaveLength(1)
      expect(health.skills).toHaveLength(1)
      expect(health.budgets).toEqual([{ path: 'README.md', used: 4, limit: 100 }])
      expect(health.gates.map(gate => gate.script)).toEqual(['doc-sync', 'verify-md-links'])
    }
    finally {
      repo.cleanup()
    }
  })
})
