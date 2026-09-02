/**
 * Verify relative Markdown links resolve to existing files. Adapted from the
 * DeepSeek Harness gate (scripts/verify-md-links.ts) under MIT.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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
    else if (entry.endsWith('.md') && !entry.endsWith('.zh.md')) out.push(abs)
  }
  return out
}

const errors: string[] = []
let checked = 0

/** Strip inline code spans so links inside backticks are not scanned. */
function stripInlineCode(line: string): string {
  return line.replace(/`[^`]*`/g, '')
}

for (const file of collectMarkdownFiles(ROOT)) {
  let inFence = false
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue
    const prose = stripInlineCode(line)
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(prose)) !== null) {
      const target = m[1] ?? ''
      if (target.startsWith('http') || target.startsWith('#') || target.startsWith('mailto:')) continue
      const pathPart = target.split('#')[0] ?? ''
      if (!pathPart) continue
      const abs = resolve(dirname(file), pathPart)
      checked++
      if (!existsSync(abs)) errors.push(`${file}: broken link → ${target}`)
    }
  }
}

if (errors.length === 0) {
  console.log(`verify-md-links: ${checked} link(s) checked, all resolve.`)
  process.exit(0)
}
console.error('verify-md-links: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
