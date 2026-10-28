/** Temporary repository fixtures for the devkit-repo tests. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** A temporary repository root that owns its files and can remove them again. */
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
  const root = mkdtempSync(join(tmpdir(), 'devkit-repo-'))
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

/** A note body whose header and sections satisfy the note gates. */
export const VALID_NOTE = `# Agent Note: 示例决策

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
