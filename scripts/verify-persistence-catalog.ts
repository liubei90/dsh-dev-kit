/**
 * Verify that `docs/persistence-catalog.md` is exactly what the generator would write.
 *
 * Usage: node scripts/verify-persistence-catalog.ts
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CATALOG_PATH, renderCatalog } from './persistence-catalog.ts'
import { loadRecords } from './persistence-changes.ts'
import { loadMigrations, parseMigrations, schemaDigest } from './persistence-schema.ts'

const root = resolve(import.meta.dirname, '..')
const schema = parseMigrations(loadMigrations(root))
const expected = renderCatalog(schema, loadRecords(root))
const absolute = resolve(root, CATALOG_PATH)

if (!existsSync(absolute)) {
  console.error(`verify-persistence-catalog: ${CATALOG_PATH} is missing.`)
  console.error('Run `pnpm run gen-persistence-catalog` (or `node scripts/gen-persistence-catalog.ts`) to create it.')
  process.exit(1)
}

const actual = readFileSync(absolute, 'utf8')
if (actual !== expected) {
  const actualLines = actual.split('\n')
  const expectedLines = expected.split('\n')
  let line = 1
  while (line <= expectedLines.length && line <= actualLines.length && actualLines[line - 1] === expectedLines[line - 1]) {
    line += 1
  }
  console.error(`verify-persistence-catalog: ${CATALOG_PATH} differs from a fresh generation at line ${line}:`)
  console.error(`  expected: ${expectedLines[line - 1] ?? '<end of file>'}`)
  console.error(`  actual:   ${actualLines[line - 1] ?? '<end of file>'}`)
  console.error('Run `pnpm run gen-persistence-catalog` (or `node scripts/gen-persistence-catalog.ts`) to regenerate it.')
  process.exit(1)
}

console.log(`verify-persistence-catalog: ${CATALOG_PATH} matches the generated catalog (Schema 摘要：${schemaDigest(schema)}).`)
