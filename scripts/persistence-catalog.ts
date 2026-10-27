/**
 * Render the generated persistence catalog at `docs/persistence-catalog.md`.
 *
 * The catalog is a pure projection of the parsed migration schema and the
 * change record chain. Its first digest line is the one
 * `verify-persistence-catalog` compares against a fresh generation.
 */

import { schemaDigest, type Schema } from './persistence-schema.ts'
import type { PersistenceRecord } from './persistence-changes.ts'

/** Repository-relative path of the generated catalog. */
export const CATALOG_PATH = 'docs/persistence-catalog.md'

/** Render the catalog for a schema and its confirmed change records. */
export function renderCatalog(schema: Schema, records: readonly PersistenceRecord[]): string {
  const lines: string[] = [
    '# 持久化 schema 目录',
    '',
    '由 `pnpm run gen-persistence-catalog` 生成，不要手改。',
    '',
    `Schema 摘要：${schemaDigest(schema)}`,
    '',
    '## 表',
    '',
  ]
  const tables = [...schema.tables].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  if (tables.length === 0) {
    lines.push('当前没有表（`apps/api/migrations/` 下没有迁移文件）。', '')
  }
  for (const table of tables) {
    lines.push(`### ${inlineCode(table.name)}`, '')
    lines.push('| 列 | 类型 | NOT NULL | PK | UNIQUE | DEFAULT | REFERENCES |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const column of table.columns) {
      const row = [
        inlineCode(column.name),
        inlineCode(column.type),
        yesNo(column.notNull),
        yesNo(column.primaryKey),
        yesNo(column.unique),
        optionalCode(column.defaultValue),
        optionalCode(column.references),
      ]
      lines.push(`| ${row.join(' | ')} |`)
    }
    lines.push('')
    if (table.constraints.length > 0) {
      lines.push('表级约束：', '')
      for (const constraint of table.constraints) lines.push(`- ${inlineCode(constraint)}`)
      lines.push('')
    }
  }
  lines.push('## 索引', '')
  const indexes = [...schema.indexes].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  if (indexes.length === 0) {
    lines.push('当前没有索引。')
  } else {
    lines.push('| 索引 | 表 | 列 | UNIQUE |')
    lines.push('|---|---|---|---|')
    for (const index of indexes) {
      lines.push(`| ${inlineCode(index.name)} | ${inlineCode(index.table)} | ${index.columns.map(column => inlineCode(column)).join(', ')} | ${yesNo(index.unique)} |`)
    }
  }
  lines.push('', '## 已确认的变更', '')
  const sortedRecords = [...records].sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
  if (sortedRecords.length === 0) {
    lines.push('当前没有持久化变更记录。schema 为空时记录链为空是合法状态；schema 非空时 `verify-persistence-changes` 会要求新增记录。')
  } else {
    lines.push('| 日期 | 标题 | Schema 摘要 |')
    lines.push('|---|---|---|')
    for (const record of sortedRecords) {
      const date = record.date === '' ? '—' : record.date
      lines.push(`| ${date} | [${linkText(record.title)}](persistence-changes/${record.file}) | ${inlineCode(record.digest)} |`)
    }
  }
  return `${lines.join('\n')}\n`
}

/** Escape one GFM table cell. */
function escapeCell(value: string): string {
  return value.replaceAll('\n', ' ').replaceAll('|', '\\|').trim()
}

/** Format a value as inline code, falling back to plain text when it contains a backtick. */
function inlineCode(value: string): string {
  const escaped = escapeCell(value)
  if (escaped === '') return '—'
  return escaped.includes('`') ? escaped : `\`${escaped}\``
}

/** Format an optional table cell. */
function optionalCode(value: string | undefined): string {
  return value === undefined ? '—' : inlineCode(value)
}

/** Render a boolean table cell. */
function yesNo(value: boolean): string {
  return value ? '是' : '否'
}

/** Escape a record title used as Markdown link text. */
function linkText(title: string): string {
  return escapeCell(title).replaceAll('[', '\\[').replaceAll(']', '\\]')
}
