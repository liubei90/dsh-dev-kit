/**
 * Verify one physical line per paragraph outside code blocks, tables, and
 * lists. Adapted from the DeepSeek Harness gate (scripts/verify-md-wrap.ts).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function collectMarkdownFiles(dir: string, depth = 0): string[] {
  if (depth > 6) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'lib' || entry === 'dist') continue
    const abs = resolve(dir, entry)
    const stat = statSync(abs)
    if (stat.isDirectory()) out.push(...collectMarkdownFiles(abs, depth + 1))
    else if (entry.endsWith('.md')) out.push(abs)
  }
  return out
}

const errors: string[] = []
for (const file of collectMarkdownFiles(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let inFence = false
  let inFrontmatter = lines[0]?.trim() === '---'
  let prevBlank = true
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (inFrontmatter) {
      if (i > 0 && line.trim() === '---') inFrontmatter = false
      continue
    }
    if (line.startsWith('```')) { inFence = !inFence; prevBlank = false; continue }
    if (inFence) continue
    const trimmed = line.trim()
    if (trimmed === '') { prevBlank = true; continue }
    const isStructure = trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)
    if (!isStructure && !prevBlank) {
      errors.push(`${file}:${i + 1}: consecutive non-blank prose lines — one physical line per paragraph`)
      break
    }
    prevBlank = isStructure
  }
}

if (errors.length === 0) {
  console.log('verify-md-wrap: all prose wrapped one line per paragraph.')
  process.exit(0)
}
console.error('verify-md-wrap: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
