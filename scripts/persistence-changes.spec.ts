import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderCatalog } from './persistence-catalog.ts'
import {
  EMPTY_SCHEMA_DIGEST,
  loadRecords,
  parseRecord,
  validateRecordChain,
} from './persistence-changes.ts'
import { schemaDigest, type Schema } from './persistence-schema.ts'

const FIRST_DIGEST = `sha256:${'a'.repeat(64)}`
const SECOND_DIGEST = `sha256:${'b'.repeat(64)}`

interface RecordOptions {
  readonly title?: string
  readonly digest?: string
  readonly predecessor?: string
  readonly sections?: readonly string[]
}

function recordSource(options: RecordOptions = {}): string {
  const title = options.title ?? '加索引'
  const digest = options.digest ?? FIRST_DIGEST
  const predecessor = options.predecessor ?? 'none'
  const sections = options.sections ?? ['## 变更', '## 兼容性', '## 验证与回滚']
  return [
    `# 持久化变更：${title}`,
    '',
    `Schema-Digest: ${digest}`,
    `Predecessor: ${predecessor}`,
    '',
    ...sections.flatMap(section => [section, '', '记录正文。', '']),
  ].join('\n')
}

function parsed(options: RecordOptions, file: string) {
  return parseRecord(recordSource(options), file)
}

describe('parseRecord', () => {
  it('parses the header and required sections', () => {
    const record = parsed({ title: '新增用户邮箱索引' }, '2026-10-27-add-user-email-index.md')
    expect(record.file).toBe('2026-10-27-add-user-email-index.md')
    expect(record.date).toBe('2026-10-27')
    expect(record.title).toBe('新增用户邮箱索引')
    expect(record.digest).toBe(FIRST_DIGEST)
    expect(record.predecessor).toBe('none')
    expect(record.sections).toEqual(['## 变更', '## 兼容性', '## 验证与回滚'])
  })

  it('accepts the required sections in any order', () => {
    const record = parsed(
      { sections: ['## 兼容性', '## 验证与回滚', '## 变更'] },
      '2026-10-27-add-user-email-index.md',
    )
    expect(record.sections).toEqual(['## 兼容性', '## 验证与回滚', '## 变更'])
  })

  it('normalizes a BOM and CRLF line endings', () => {
    const source = `\uFEFF${recordSource()}`.replaceAll('\n', '\r\n')
    expect(parseRecord(source, '2026-10-27-add-user-email-index.md').title).toBe('加索引')
  })

  it('rejects a missing or malformed header value', () => {
    expect(() => parseRecord(recordSource().replace('Schema-Digest: ', 'Digest: '), '2026-10-27-bad-digest.md'))
      .toThrow(/Schema-Digest/)
    expect(() => parsed({ digest: 'sha256:not-hex' }, '2026-10-27-bad-digest.md'))
      .toThrow(/Schema-Digest/)
    expect(() => parsed({ predecessor: 'README.md' }, '2026-10-27-bad-predecessor.md'))
      .toThrow(/Predecessor/)
    expect(() => parseRecord(recordSource().replace('# 持久化变更：', '# 变更：'), '2026-10-27-bad-title.md'))
      .toThrow(/持久化变更/)
  })

  it('rejects a record without every required section', () => {
    expect(() => parsed({ sections: ['## 变更', '## 验证与回滚'] }, '2026-10-27-missing-section.md'))
      .toThrow(/"## 兼容性"/)
  })
})

describe('validateRecordChain', () => {
  it('accepts a valid chain ending at the current digest', () => {
    const first = parsed({ title: '初始 schema' }, '2026-10-01-initial.md')
    const second = parsed(
      { title: '加索引', digest: SECOND_DIGEST, predecessor: '2026-10-01-initial.md' },
      '2026-10-02-add-index.md',
    )
    expect(validateRecordChain([first, second], SECOND_DIGEST)).toEqual([])
  })

  it('rejects a file name that is not a dated record', () => {
    const errors = validateRecordChain([parsed({}, 'notes.md')], FIRST_DIGEST)
    expect(errors.some(error => error.includes('record file name must match'))).toBe(true)
  })

  it('rejects an invalid calendar date in the file name', () => {
    const errors = validateRecordChain([parsed({}, '2026-02-30-impossible-date.md')], FIRST_DIGEST)
    expect(errors.some(error => error.includes('not a valid calendar date'))).toBe(true)
  })

  it('requires the first record to declare no predecessor', () => {
    const errors = validateRecordChain(
      [parsed({ predecessor: '2026-09-30-earlier.md' }, '2026-10-01-initial.md')],
      FIRST_DIGEST,
    )
    expect(errors.some(error => error.includes('the first record must declare "Predecessor: none"'))).toBe(true)
  })

  it('requires each predecessor to name the previous record', () => {
    const first = parsed({ title: '初始 schema' }, '2026-10-01-initial.md')
    const second = parsed(
      { title: '加索引', digest: SECOND_DIGEST, predecessor: '2026-09-30-elsewhere.md' },
      '2026-10-02-add-index.md',
    )
    const errors = validateRecordChain([first, second], SECOND_DIGEST)
    expect(errors.some(error => error.includes('Predecessor must name the previous record'))).toBe(true)
  })

  it('rejects adjacent records with the same digest', () => {
    const first = parsed({ title: '初始 schema' }, '2026-10-01-initial.md')
    const second = parsed({ title: '未变更', predecessor: '2026-10-01-initial.md' }, '2026-10-02-no-change.md')
    const errors = validateRecordChain([first, second], FIRST_DIGEST)
    expect(errors.some(error => error.includes('duplicates its predecessor'))).toBe(true)
  })

  it('requires the latest digest to equal the current schema digest', () => {
    const first = parsed({ title: '初始 schema' }, '2026-10-01-initial.md')
    const errors = validateRecordChain([first], SECOND_DIGEST)
    expect(errors.some(error => error.includes('does not match the current schema digest'))).toBe(true)
  })

  it('accepts an empty chain for an empty schema and rejects it otherwise', () => {
    expect(validateRecordChain([], EMPTY_SCHEMA_DIGEST)).toEqual([])
    const errors = validateRecordChain([], FIRST_DIGEST)
    expect(errors.some(error => error.includes('schema 已变化但没有持久化变更记录'))).toBe(true)
  })
})

describe('loadRecords', () => {
  it('reads dated records and ignores README.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'persistence-records-'))
    try {
      const directory = join(root, 'docs', 'persistence-changes')
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, 'README.md'), '# 说明\n')
      writeFileSync(join(directory, '2026-10-27-add-index.md'), recordSource({ title: '加索引' }))
      writeFileSync(join(directory, 'notes.txt'), 'ignored\n')
      expect(loadRecords(root).map(record => record.file)).toEqual(['2026-10-27-add-index.md'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('renderCatalog', () => {
  it('renders a valid empty catalog for an empty schema and empty chain', () => {
    const catalog = renderCatalog({ tables: [], indexes: [] }, [])
    expect(catalog.startsWith('# 持久化 schema 目录\n')).toBe(true)
    expect(catalog).toContain('由 `pnpm run gen-persistence-catalog` 生成，不要手改。')
    expect(catalog).toContain(`Schema 摘要：${EMPTY_SCHEMA_DIGEST}`)
    expect(catalog).toContain('当前没有表')
    expect(catalog).toContain('当前没有索引。')
    expect(catalog).toContain('## 已确认的变更')
    expect(catalog).toContain('当前没有持久化变更记录')
    expect(catalog.endsWith('\n')).toBe(true)
    expect(catalog.endsWith('\n\n')).toBe(false)
  })

  it('lists table columns, indexes, and confirmed change records', () => {
    const schema: Schema = {
      tables: [{
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true, unique: false },
          { name: 'email', type: 'TEXT', notNull: true, primaryKey: false, unique: true, defaultValue: "'anon'" },
        ],
        constraints: ['PRIMARY KEY (id)'],
      }],
      indexes: [{ name: 'idx_users_email', table: 'users', columns: ['email'], unique: true }],
    }
    const record = parsed(
      { title: '加邮箱索引', digest: schemaDigest(schema) },
      '2026-10-27-add-email-index.md',
    )
    const catalog = renderCatalog(schema, [record])
    expect(catalog).toContain(`Schema 摘要：${schemaDigest(schema)}`)
    expect(catalog).toContain('### `users`')
    expect(catalog).toContain('| `id` | `INTEGER` | 是 | 是 | 否 | — | — |')
    expect(catalog).toContain('| `email` | `TEXT` | 是 | 否 | 是 | `\'anon\'` | — |')
    expect(catalog).toContain('- `PRIMARY KEY (id)`')
    expect(catalog).toContain('| `idx_users_email` | `users` | `email` | 是 |')
    expect(catalog).toContain('[加邮箱索引](persistence-changes/2026-10-27-add-email-index.md)')
    expect(catalog).toContain(`| 2026-10-27 | [加邮箱索引](persistence-changes/2026-10-27-add-email-index.md) | \`${schemaDigest(schema)}\` |`)
  })
})
