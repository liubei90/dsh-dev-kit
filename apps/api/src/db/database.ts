// SQLite connection and ordered migration runner. Migrations live in
// apps/api/migrations as NNNN_name.sql; the runner records applied files in a
// schema_migrations table, so startup and the migrate CLI stay idempotent.

import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

/** Resolves to apps/api/migrations both from src (tsx) and lib (built). */
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url))

export function openDatabase(path: string): Database.Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }
  const db = new Database(path)
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL')
  }
  return db
}

/**
 * Apply every migration file not yet recorded, in numeric filename order.
 * Each file runs inside one transaction and then records its version.
 */
export function runMigrations(
  db: Database.Database,
  migrationsDir: string = MIGRATIONS_DIR,
): string[] {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  )
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>).map(
      (row) => row.version,
    ),
  )
  const files = readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
  const record = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  )
  const appliedNow: string[] = []
  for (const file of files) {
    if (applied.has(file)) continue
    const apply = db.transaction(() => {
      db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
      record.run(file, new Date().toISOString())
    })
    apply()
    appliedNow.push(file)
  }
  return appliedNow
}
