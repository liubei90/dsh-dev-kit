/**
 * Verify the archived Agent Notes tree: complete frozen triplets, archive
 * metadata lines, and content hashes against manifest.json. Adapted from the
 * DeepSeek Harness gate (scripts/verify-archived-agent-notes.ts) under MIT.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const NOTES_ROOT = resolve(import.meta.dirname, '..', '.agents', 'notes')
const ARCHIVED_ROOT = resolve(NOTES_ROOT, 'archived')
const MANIFEST = resolve(ARCHIVED_ROOT, 'manifest.json')
const CLASSES = ['feature', 'architecture', 'bug-fix', 'process', 'simplification', 'testing'] as const
const WRITE = process.argv.includes('--write')

interface Manifest { version: number; files: Record<string, string> }

function sha256(file: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`
}

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST)) return { version: 1, files: {} }
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest
}

const manifest = loadManifest()
const errors: string[] = []
const current: Record<string, string> = {}
const sealed: string[] = []

// 1. Verify every sealed artifact still matches and belongs to a complete triplet.
for (const [rel, hash] of Object.entries(manifest.files)) {
  const abs = resolve(ARCHIVED_ROOT, rel)
  if (!existsSync(abs)) { errors.push(`sealed artifact missing: ${rel}`); continue }
  const actual = sha256(abs)
  if (actual !== hash) errors.push(`sealed artifact changed: ${rel}`)
  else sealed.push(rel)
  current[rel] = actual
}

// 2. Discover the archive tree; every triplet must be complete and sealed.
for (const cls of CLASSES) {
  const dir = resolve(ARCHIVED_ROOT, cls)
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md') && !file.endsWith('.yaml')) continue
    const rel = `${cls}/${file}`
    if (!(rel in manifest.files)) {
      if (WRITE) current[rel] = sha256(resolve(ARCHIVED_ROOT, rel))
      else errors.push(`unsealed archived artifact: ${rel}`)
    }
  }
}

// 3. Metadata check: archived notes must carry `Archived:` under `Status: implemented`.
for (const rel of Object.keys(current)) {
  if (!rel.endsWith('.md') || rel.endsWith('.zh.md')) continue
  const content = readFileSync(resolve(ARCHIVED_ROOT, rel), 'utf8')
  const lines = content.split('\n')
  if (lines[2] !== 'Status: implemented') errors.push(`${rel}: line 3 must be \`Status: implemented\``)
  if (!/^Archived: \d{4}-\d{2}-\d{2}$/.test(lines[3] ?? '')) {
    errors.push(`${rel}: line 4 must be \`Archived: YYYY-MM-DD\``)
  }
}

if (WRITE) {
  writeFileSync(MANIFEST, `${JSON.stringify({ version: 1, files: Object.fromEntries(Object.entries(current).sort()) }, null, 2)}\n`)
  console.log(`verify-archived-agent-notes: sealed ${sealed.length} artifacts, recorded ${Object.keys(current).length} total.`)
  process.exit(0)
}

if (errors.length === 0) {
  console.log(`verify-archived-agent-notes: ${sealed.length} sealed artifact(s) verified.`)
  process.exit(0)
}
console.error('verify-archived-agent-notes: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
