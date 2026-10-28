import { describe, expect, it } from 'vitest'
import { readSkills } from '../src/skills.js'
import { createTempRepo } from './fixture.js'

describe('readSkills', () => {
  it('reads name and description from front matter', () => {
    const repo = createTempRepo()
    try {
      repo.write('.agents/skills/zeta/SKILL.md', '---\nname: zeta\ndescription: 最后一个\n---\n\n# Zeta\n')
      repo.write('.agents/skills/alpha/SKILL.md', '---\nname: alpha\ndescription: "第一个"\n---\n\n# Alpha\n')

      const skills = readSkills(repo.root)
      expect(skills.map(skill => skill.name)).toEqual(['alpha', 'zeta'])
      expect(skills[0]?.description).toBe('第一个')
      expect(skills[0]?.path).toBe('.agents/skills/alpha/SKILL.md')
    }
    finally {
      repo.cleanup()
    }
  })

  it('skips a directory without SKILL.md', () => {
    const repo = createTempRepo()
    try {
      repo.write('.agents/skills/empty/.keep', '')
      expect(readSkills(repo.root)).toEqual([])
    }
    finally {
      repo.cleanup()
    }
  })

  it('rejects malformed front matter', () => {
    const repo = createTempRepo()
    try {
      repo.write('.agents/skills/broken/SKILL.md', '# 没有 front matter\n')
      expect(() => readSkills(repo.root)).toThrow(/YAML front matter/u)
    }
    finally {
      repo.cleanup()
    }
  })

  it('returns no skills when the catalog is absent', () => {
    const repo = createTempRepo()
    try {
      expect(readSkills(repo.root)).toEqual([])
    }
    finally {
      repo.cleanup()
    }
  })
})
