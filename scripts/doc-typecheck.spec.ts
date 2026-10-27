/**
 * Pure-function coverage for `doc-typecheck`: fence classification, fence
 * extraction with document lines, the opt-out ratio including its exact limit,
 * and the empty-document case. No compiler run is involved.
 */

import { describe, expect, it } from 'vitest'
import { classifyInfo, extractTsBlocks, ignoreRatio, ignoreRatioExceeded } from './doc-typecheck.ts'
import type { BlockKind, TsBlock } from './doc-typecheck.ts'

/** Build `checked` compile blocks and `ignored` opt-out blocks. */
function blocksOf(checked: number, ignored: number): TsBlock[] {
  const make = (kind: BlockKind): TsBlock => ({ file: 'docs/probe.md', line: 1, kind, code: 'export {}\n' })
  return [
    ...Array.from({ length: checked }, () => make('check')),
    ...Array.from({ length: ignored }, () => make('ignore')),
  ]
}

describe('classifyInfo', () => {
  it('compiles `ts` and exempts `ts ignore-check`', () => {
    expect(classifyInfo('ts')).toBe('check')
    expect(classifyInfo('ts ignore-check')).toBe('ignore')
  })

  it('folds extra whitespace inside a known info string', () => {
    expect(classifyInfo('  ts   ignore-check  ')).toBe('ignore')
    expect(classifyInfo(' ts ')).toBe('check')
  })

  it('ignores other languages, bare words, and unrelated ts meta', () => {
    for (const info of ['', 'sh', 'text', 'markdown', 'json', 'typescript', 'ts type-equiv', 'ts ignore', 'tsx']) {
      expect(classifyInfo(info)).toBeUndefined()
    }
  })
})

describe('extractTsBlocks', () => {
  const source = [
    '# Doc', // 1
    '', // 2
    'Intro.', // 3
    '', // 4
    '```ts', // 5
    'const a: number = 1', // 6
    "const b: string = 'x'", // 7
    '```', // 8
    '', // 9
    '```sh', // 10
    'echo hi', // 11
    '```', // 12
    '', // 13
    '```ts ignore-check', // 14
    'declare const runtime: unknown', // 15
    'runtime', // 16
    '```', // 17
  ].join('\n')

  it('keeps the opening fence line, the kind, and the body of each ts fence', () => {
    expect(extractTsBlocks(source, 'docs/probe.md')).toEqual([
      { file: 'docs/probe.md', line: 5, kind: 'check', code: "const a: number = 1\nconst b: string = 'x'" },
      { file: 'docs/probe.md', line: 14, kind: 'ignore', code: 'declare const runtime: unknown\nruntime' },
    ])
  })

  it('returns no blocks for a document without fences', () => {
    expect(extractTsBlocks('No code here.\n', 'docs/probe.md')).toEqual([])
  })

  it('returns no blocks for an empty document', () => {
    expect(extractTsBlocks('', 'docs/empty.md')).toEqual([])
  })
})

describe('ignoreRatio', () => {
  it('is zero when nothing opts out and does not trip the limit', () => {
    expect(ignoreRatio(blocksOf(4, 0))).toBe(0)
    expect(ignoreRatioExceeded(blocksOf(4, 0))).toBe(false)
  })

  it('passes at exactly 25 percent', () => {
    expect(ignoreRatio(blocksOf(3, 1))).toBe(0.25)
    expect(ignoreRatioExceeded(blocksOf(3, 1))).toBe(false)
    expect(ignoreRatioExceeded(blocksOf(12, 4))).toBe(false)
  })

  it('fails above 25 percent', () => {
    expect(ignoreRatio(blocksOf(3, 2))).toBeCloseTo(0.4)
    expect(ignoreRatioExceeded(blocksOf(3, 2))).toBe(true)
    expect(ignoreRatioExceeded(blocksOf(2, 1))).toBe(true)
    expect(ignoreRatioExceeded(blocksOf(0, 1))).toBe(true)
  })

  it('is zero and unsupervised for a document with no recognized fences', () => {
    expect(ignoreRatio([])).toBe(0)
    expect(ignoreRatioExceeded([])).toBe(false)
  })
})
