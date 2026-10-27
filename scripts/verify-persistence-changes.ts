/**
 * Verify the persistence change record chain against the current migration schema.
 *
 * Usage: node scripts/verify-persistence-changes.ts
 */

import { resolve } from 'node:path'
import {
  PersistenceRecordError,
  parseRecord,
  readRecordSources,
  validateRecordChain,
  type PersistenceRecord,
} from './persistence-changes.ts'
import { loadMigrations, parseMigrations, schemaDigest } from './persistence-schema.ts'

const root = resolve(import.meta.dirname, '..')
const digest = schemaDigest(parseMigrations(loadMigrations(root)))
const errors: string[] = []
const records: PersistenceRecord[] = []

for (const { file, source } of readRecordSources(root)) {
  try {
    records.push(parseRecord(source, file))
  } catch (error) {
    if (!(error instanceof PersistenceRecordError)) throw error
    errors.push(error.message)
  }
}
if (errors.length === 0) errors.push(...validateRecordChain(records, digest))

if (errors.length > 0) {
  console.error('verify-persistence-changes failed:\n')
  for (const error of errors) console.error(`  ${error}`)
  console.error('\nFix the record chain, then rerun `node scripts/verify-persistence-changes.ts`.')
  process.exit(1)
}

console.log(`verify-persistence-changes: ${records.length} record(s) match the current schema digest ${digest}.`)
