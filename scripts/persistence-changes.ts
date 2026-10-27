/**
 * Read, parse, and validate the persistence change record chain in
 * `docs/persistence-changes/`.
 *
 * A record binds one schema digest to its direct predecessor. The chain starts
 * with `Predecessor: none`, every later record names the previous file, every
 * digest differs from its predecessor, and the last digest equals the current
 * schema digest. An empty chain is valid only while the schema itself is empty.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { schemaDigest } from './persistence-schema.ts'

/** Repository-relative directory holding one Markdown file per change record. */
export const RECORDS_DIRECTORY = 'docs/persistence-changes'

/** Digest of the canonical empty schema; an empty record chain is valid only for it. */
export const EMPTY_SCHEMA_DIGEST = schemaDigest({ tables: [], indexes: [] })

const RECORD_FILE_NAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const DIGEST_VALUE = /^sha256:[0-9a-f]{64}$/
const HEADING_PREFIX = '# 持久化变更：'
const REQUIRED_SECTIONS = ['## 变更', '## 兼容性', '## 验证与回滚'] as const

/** One parsed change record. */
export interface PersistenceRecord {
  /** Record file name relative to {@link RECORDS_DIRECTORY}. */
  readonly file: string
  /** Calendar date derived from the file name, or an empty string for a non-conforming name. */
  readonly date: string
  /** Title after `# 持久化变更：`. */
  readonly title: string
  /** Declared `Schema-Digest` value, including the `sha256:` prefix. */
  readonly digest: string
  /** `none` for the first record, otherwise the previous record's file name. */
  readonly predecessor: string
  /** Required level-2 headings found in the record, in source order. */
  readonly sections: readonly string[]
}

/** One record file and its raw source, before header validation. */
export interface RecordSource {
  /** Record file name relative to {@link RECORDS_DIRECTORY}. */
  readonly file: string
  /** Full Markdown source. */
  readonly source: string
}

/** Raised when a record file does not match the required header or section layout. */
export class PersistenceRecordError extends Error {
  override name = 'PersistenceRecordError'
}

/**
 * Parse one change record.
 * @param source - full Markdown source; a leading BOM and CRLF line endings are normalized.
 * @param file - record file name relative to {@link RECORDS_DIRECTORY}, used in diagnostics and the date.
 * @returns the parsed record.
 * @throws PersistenceRecordError when the header order, digest, predecessor, or required sections are wrong.
 */
export function parseRecord(source: string, file: string): PersistenceRecord {
  const normalized = source.replace(/^\uFEFF/u, '').replaceAll('\r\n', '\n')
  const lines = normalized.split('\n')
  const heading = lines[0] ?? ''
  if (!heading.startsWith(HEADING_PREFIX)) {
    throw new PersistenceRecordError(
      `${file}: the first line must be "# 持久化变更：<title>", got ${JSON.stringify(heading)}`,
    )
  }
  const title = heading.slice(HEADING_PREFIX.length).trim()
  if (title === '') throw new PersistenceRecordError(`${file}: the title after "# 持久化变更：" is empty`)
  if ((lines[1] ?? '').trim() !== '') {
    throw new PersistenceRecordError(`${file}: line 2 must be blank between the title and "Schema-Digest:"`)
  }
  const digestLine = lines[2] ?? ''
  const digestMatch = /^Schema-Digest: (sha256:[0-9a-f]{64})$/u.exec(digestLine)
  if (digestMatch === null) {
    throw new PersistenceRecordError(
      `${file}: line 3 must be "Schema-Digest: sha256:<64 lowercase hex>", got ${JSON.stringify(digestLine)}`,
    )
  }
  const digest = digestMatch[1]
  if (digest === undefined) throw new PersistenceRecordError(`${file}: the Schema-Digest value is missing`)
  const predecessorLine = lines[3] ?? ''
  const predecessorMatch = /^Predecessor: (none|\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/u.exec(predecessorLine)
  if (predecessorMatch === null) {
    throw new PersistenceRecordError(
      `${file}: line 4 must be "Predecessor: none" or "Predecessor: <previous record file name>", got ${JSON.stringify(predecessorLine)}`,
    )
  }
  const predecessor = predecessorMatch[1]
  if (predecessor === undefined) throw new PersistenceRecordError(`${file}: the Predecessor value is missing`)
  const sections: string[] = []
  for (const line of lines.slice(4)) {
    const trimmed = line.trimEnd()
    if (REQUIRED_SECTIONS.some(section => section === trimmed) && !sections.includes(trimmed)) sections.push(trimmed)
  }
  const missing = REQUIRED_SECTIONS.filter(section => !sections.includes(section))
  if (missing.length > 0) {
    throw new PersistenceRecordError(
      `${file}: missing required section(s) ${missing.map(section => JSON.stringify(section)).join(', ')}; `
      + 'a record needs "## 变更", "## 兼容性", and "## 验证与回滚"',
    )
  }
  return { file, date: dateFromFile(file), title, digest, predecessor, sections }
}

/**
 * Validate the record chain against the current schema digest.
 * @param records - records ordered from oldest to newest, as stored on disk.
 * @param currentDigest - digest of the schema parsed from the current migrations.
 * @returns one actionable message per violation; an empty array means the chain is valid.
 */
export function validateRecordChain(records: readonly PersistenceRecord[], currentDigest: string): string[] {
  const errors: string[] = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record === undefined) continue
    const file = record.file
    if (!RECORD_FILE_NAME.test(file)) {
      errors.push(
        `${file}: record file name must match "yyyy-mm-dd-<slug>.md" using lowercase letters, digits, and single hyphens`,
      )
    }
    const fileDate = dateFromFile(file)
    if (fileDate !== '' && !isValidCalendarDate(fileDate)) {
      errors.push(`${file}: date "${fileDate}" in the record file name is not a valid calendar date`)
    } else if (fileDate !== '' && record.date !== '' && record.date !== fileDate) {
      errors.push(`${file}: record date "${record.date}" does not match the file name date "${fileDate}"`)
    }
    if (!DIGEST_VALUE.test(record.digest)) {
      errors.push(`${file}: Schema-Digest must be "sha256:<64 lowercase hex>", got ${JSON.stringify(record.digest)}`)
    }
    if (index === 0) {
      if (record.predecessor !== 'none') {
        errors.push(`${file}: the first record must declare "Predecessor: none", got ${JSON.stringify(record.predecessor)}`)
      }
      continue
    }
    const previous = records[index - 1]
    if (previous === undefined) continue
    if (record.predecessor !== previous.file) {
      errors.push(
        `${file}: Predecessor must name the previous record "${previous.file}", got ${JSON.stringify(record.predecessor)}`,
      )
    }
    if (record.digest === previous.digest) {
      errors.push(`${file}: Schema-Digest duplicates its predecessor ${previous.file}; every record must change the digest`)
    }
  }
  if (records.length === 0) {
    if (currentDigest !== EMPTY_SCHEMA_DIGEST) {
      errors.push(
        'schema 已变化但没有持久化变更记录 (schema changed without a persistence change record): '
        + `current digest ${currentDigest}; add ${RECORDS_DIRECTORY}/yyyy-mm-dd-<slug>.md with "Predecessor: none"`,
      )
    }
    return errors
  }
  const latest = records[records.length - 1]
  if (latest !== undefined && latest.digest !== currentDigest) {
    errors.push(
      `${latest.file}: latest record digest ${latest.digest} does not match the current schema digest ${currentDigest}; `
      + 'add a new record whose Schema-Digest is the current digest',
    )
  }
  return errors
}

/** Read every record source in file name order; `README.md` and non-Markdown files are skipped. */
export function readRecordSources(root: string): RecordSource[] {
  const directory = resolve(root, RECORDS_DIRECTORY)
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map(entry => entry.name)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map(file => ({ file, source: readFileSync(resolve(directory, file), 'utf8') }))
}

/**
 * Read and parse every record under {@link RECORDS_DIRECTORY}.
 * @param root - repository root.
 * @returns parsed records in file name order.
 * @throws PersistenceRecordError from {@link parseRecord} when any record is malformed.
 */
export function loadRecords(root: string): PersistenceRecord[] {
  return readRecordSources(root).map(({ file, source }) => parseRecord(source, file))
}

/** Extract the `yyyy-mm-dd` prefix from a record file name, or `''` when absent. */
function dateFromFile(file: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})-/u.exec(file)
  return match?.[1] ?? ''
}

/** Whether a `yyyy-mm-dd` string is a real calendar date. */
function isValidCalendarDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date)
  if (match === null) return false
  const [, yearText = '', monthText = '', dayText = ''] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}
