/** Temporary repository fixtures for the console tests. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** A temporary repository root that owns its files. */
export interface TempRepo {
  readonly root: string
  write(path: string, content: string): void
  cleanup(): void
}

/**
 * Create one empty temporary repository.
 * @returns a handle whose `write` creates parent directories and whose `cleanup` removes the tree.
 */
export function createTempRepo(): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'devkit-console-'))
  return {
    root,
    write(path: string, content: string): void {
      const absolute = join(root, path)
      mkdirSync(dirname(absolute), { recursive: true })
      writeFileSync(absolute, content, 'utf8')
    },
    cleanup(): void {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
    },
  }
}

const NOTE = `# Agent Note: <script>alert(1)</script>

Status: implemented

## Problem

需要示例。

## Decision

决定采用 [架构](../../../../docs/architecture.md)。

## Alternatives considered

- **不建** —— 否决：需要示例。

## Consequences

无。
`

/** Write the repository the console tests project. */
export function writeFixture(repo: TempRepo): void {
  repo.write('package.json', JSON.stringify({
    name: 'console-fixture',
    private: true,
    scripts: {
      'verify-ok': 'node -e "console.log(\'ok\')"',
      'verify-fail': 'node -e "process.exit(3)"',
      'verify-slow': 'node -e "setTimeout(() => {}, 10000)"',
      'verify-loud': 'node -e "process.stdout.write(\'x\'.repeat(500))"',
      'doc-sync': 'node -e "console.log(\'sync\')"',
      'console': 'tsx tools/console/src/server.ts',
    },
  }, null, 2))
  repo.write('README.md', '# 示例项目\n\n正文标记 README_CONTENT_MARKER。\n\n见 [架构](docs/architecture.md)。\n')
  repo.write('AGENTS.md', '# 代理\n\n见 [架构](docs/architecture.md)。\n')
  repo.write('docs/architecture.md', `# 架构

见 [笔记](../.agents/notes/implemented/feature/2026-01-02-example.md)。

\`\`\`md
[围栏](missing.md)
\`\`\`

[外链](https://example.com)
`)
  repo.write('docs/AGENTS.md', '# 文档标准\n')
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
  }, null, 2))
  repo.write('docs/notes.md', '# 说明\n')
  repo.write('scripts/doc-budgets.manifest.json', JSON.stringify({ 'README.md': 200, 'AGENTS.md': 200 }))
  repo.write('.agents/notes/implemented/feature/2026-01-02-example.md', NOTE)
  repo.write('.agents/skills/demo/SKILL.md', '---\nname: demo\ndescription: 示例技能\n---\n\n# Demo\n\n见 [架构](../../../docs/architecture.md)。\n')
  repo.write('apps/web/README.md', '# Web\n\n见 [架构](../../docs/architecture.md)。\n')
  repo.write('scripts/README.md', '# 脚本\n')
}
