import { describe, expect, it } from 'vitest'
import { readAgentNotes } from '../src/notes.js'
import { VALID_NOTE, createTempRepo } from './fixture.js'

describe('readAgentNotes', () => {
  it('reads notes sorted by date and keeps every section', () => {
    const repo = createTempRepo()
    try {
      repo.write('.agents/notes/implemented/feature/2026-01-02-example.md', VALID_NOTE)
      repo.write('.agents/notes/implemented/feature/2026-01-03-newer.md', VALID_NOTE.replace('示例决策', '更新的决策'))
      repo.write('.agents/notes/proposed/process/2026-01-01-draft.md', `# Agent Note: 草案

Status: proposed

## Problem

问题。

## Proposal

提案。

## Alternatives considered

- **不建** —— 否决。

## Acceptance criteria

可观察。

## Risks

无。
`)

      const notes = readAgentNotes(repo.root)
      expect(notes.map(note => note.path)).toEqual([
        '.agents/notes/implemented/feature/2026-01-03-newer.md',
        '.agents/notes/implemented/feature/2026-01-02-example.md',
        '.agents/notes/proposed/process/2026-01-01-draft.md',
      ])
      expect(notes[1]?.title).toBe('示例决策')
      expect(notes[1]?.sections.map(section => section.heading)).toEqual([
        'Problem',
        'Decision',
        'Alternatives considered',
        'Consequences',
      ])
      expect(notes[1]?.summary).toContain('决定采用 架构')
    }
    finally {
      repo.cleanup()
    }
  })

  it('reads the archive seal date', () => {
    const repo = createTempRepo()
    try {
      repo.write('.agents/notes/archived/feature/2026-01-01-old.md', `# Agent Note: 旧决策

Status: implemented

Archived: 2026-01-05

## Problem

问题。

## Decision

决定。

## Alternatives considered

- **不建** —— 否决。

## Consequences

无。
`)
      const notes = readAgentNotes(repo.root)
      expect(notes[0]?.lifecycle).toBe('archived')
      expect(notes[0]?.archivedOn).toBe('2026-01-05')
    }
    finally {
      repo.cleanup()
    }
  })

  it('surfaces a note whose status disagrees with its folder', () => {
    const repo = createTempRepo()
    try {
      repo.write('.agents/notes/implemented/feature/2026-01-02-example.md', VALID_NOTE.replace('Status: implemented', 'Status: proposed'))
      expect(() => readAgentNotes(repo.root)).toThrow(/does not match the implemented folder/u)
    }
    finally {
      repo.cleanup()
    }
  })

  it('ignores heading-like lines inside fences', () => {
    const repo = createTempRepo()
    try {
      repo.write('.agents/notes/implemented/feature/2026-01-02-example.md', `# Agent Note: 围栏

Status: implemented

## Problem

问题。

## Decision

\`\`\`md
## 不是章节
\`\`\`

## Alternatives considered

- **不建** —— 否决。

## Consequences

无。
`)
      const notes = readAgentNotes(repo.root)
      expect(notes[0]?.sections.map(section => section.heading)).toEqual([
        'Problem',
        'Decision',
        'Alternatives considered',
        'Consequences',
      ])
    }
    finally {
      repo.cleanup()
    }
  })

  it('returns no notes when the tree is absent', () => {
    const repo = createTempRepo()
    try {
      expect(readAgentNotes(repo.root)).toEqual([])
    }
    finally {
      repo.cleanup()
    }
  })
})
