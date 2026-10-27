/**
 * Generate `docs/persistence-catalog.md` from the SQL migrations and change records.
 *
 * Usage: node scripts/gen-persistence-catalog.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CATALOG_PATH, renderCatalog } from './persistence-catalog.ts'
import { loadRecords } from './persistence-changes.ts'
import { loadMigrations, parseMigrations, schemaDigest } from './persistence-schema.ts'

const root = resolve(import.meta.dirname, '..')
const schema = parseMigrations(loadMigrations(root))
const records = loadRecords(root)
const absolute = resolve(root, CATALOG_PATH)

mkdirSync(dirname(absolute), { recursive: true })
writeFileSync(absolute, renderCatalog(schema, records), 'utf8')
console.log(`gen-persistence-catalog: wrote ${CATALOG_PATH} (Schema 摘要：${schemaDigest(schema)})`)
