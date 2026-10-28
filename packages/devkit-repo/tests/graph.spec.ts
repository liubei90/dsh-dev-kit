import { describe, expect, it } from 'vitest'
import { readGraph } from '../src/graph.js'
import { VALID_NOTE, createTempRepo } from './fixture.js'

describe('readGraph', () => {
  it('builds nodes and directed edges from notes, docs, and skills', () => {
    const repo = createTempRepo()
    try {
      repo.write('README.md', '# 项目\n\n见 [架构](docs/architecture.md)。\n')
      repo.write('AGENTS.md', '# 代理\n\n见 [架构](docs/architecture.md)。\n')
      repo.write('docs/architecture.md', `# 架构

见 [笔记](../.agents/notes/implemented/feature/2026-01-02-example.md)。

\`\`\`md
[围栏里的链接](missing.md)
\`\`\`

[外链](https://example.com)
[锚点](#top)
[不存在](nope.md)
`)
      repo.write('docs/AGENTS.md', '# 文档标准\n')
      repo.write('.agents/notes/implemented/feature/2026-01-02-example.md', VALID_NOTE)
      repo.write('.agents/skills/demo/SKILL.md', '---\nname: demo\ndescription: 示例技能\n---\n\n# Demo\n\n见 [架构](../../../docs/architecture.md)。\n')
      repo.write('apps/web/README.md', '# Web\n\n见 [架构](../../docs/architecture.md)。\n')
      repo.write('packages/shared/README.md', '# Shared\n\n见 [引用][arch]。\n\n[arch]: ../../docs/architecture.md\n')
      repo.write('scripts/README.md', '# 脚本\n')
      repo.write('docs/asset-ownership.json', JSON.stringify({
        version: 1,
        default: 'project',
        rules: [
          { category: 'mixed', patterns: ['AGENTS.md'] },
          {
            category: 'framework',
            patterns: ['docs/AGENTS.md', 'docs/asset-ownership.json', '.agents/skills/**'],
          },
        ],
      }))

      const graph = readGraph(repo.root)
      expect(graph.nodes).toHaveLength(9)
      expect(graph.edges).toHaveLength(7)

      const byId = new Map(graph.nodes.map(node => [node.id, node]))
      expect(byId.get('docs/architecture.md')?.title).toBe('架构')
      expect(byId.get('docs/architecture.md')?.degree).toBe(7)
      expect(byId.get('.agents/notes/implemented/feature/2026-01-02-example.md')?.degree).toBe(2)
      expect(byId.get('.agents/notes/implemented/feature/2026-01-02-example.md')?.kind).toBe('note')
      expect(byId.get('.agents/notes/implemented/feature/2026-01-02-example.md')?.noteClass).toBe('feature')
      expect(byId.get('apps/web/README.md')?.kind).toBe('doc')
      expect(byId.get('scripts/README.md')?.kind).toBe('doc')
      expect(byId.get('scripts/README.md')?.ownership).toBe('project')

      expect(byId.get('.agents/skills/demo/SKILL.md')?.ownership).toBe('framework')
      expect(byId.get('docs/AGENTS.md')?.ownership).toBe('framework')
      expect(byId.get('AGENTS.md')?.ownership).toBe('mixed')
      expect(byId.get('README.md')?.ownership).toBe('project')
      expect(byId.get('apps/web/README.md')?.ownership).toBe('project')

      expect(graph.edges).toContainEqual({
        from: 'packages/shared/README.md',
        to: 'docs/architecture.md',
      })
      expect(graph.edges).not.toContainEqual({
        from: 'docs/architecture.md',
        to: 'missing.md',
      })
    }
    finally {
      repo.cleanup()
    }
  })

  it('returns an empty graph for a repository without node files', () => {
    const repo = createTempRepo()
    try {
      repo.write('docs/asset-ownership.json', JSON.stringify({ version: 1, default: 'project', rules: [] }))
      const graph = readGraph(repo.root)
      expect(graph).toEqual({ nodes: [], edges: [] })
    }
    finally {
      repo.cleanup()
    }
  })

  it('fails when the ownership manifest is missing', () => {
    const repo = createTempRepo()
    try {
      expect(() => readGraph(repo.root)).toThrow(/asset-ownership\.json/u)
    }
    finally {
      repo.cleanup()
    }
  })
})
