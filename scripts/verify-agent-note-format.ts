/**
 * Verify Agent Note headers, lifecycle-specific sections, and the mandatory
 * Alternatives-considered section. Adapted from the DeepSeek Harness gate
 * (scripts/verify-agent-note-format.ts) under MIT; rules live in
 * .agents/notes/README.md.
 */

import { readFileSync } from 'node:fs'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const NOTES_ROOT = resolve(import.meta.dirname, '..', '.agents', 'notes')
const LIFECYCLES = ['proposed', 'implemented', 'rejected', 'archived'] as const
const CLASSES = ['feature', 'architecture', 'bug-fix', 'process', 'simplification', 'testing'] as const

const STATUS: Record<string, RegExp> = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  rejected: /^Status: rejected — .+$/,
  archived: /^Status: implemented$/,
}

const REQUIRED: Record<string, string[]> = {
  proposed: ['## Proposal', '## Acceptance criteria', '## Risks'],
  implemented: ['## Decision', '## Consequences'],
  rejected: ['## Proposal'],
}

const BANNED_IMPLEMENTED = /^## (?:Proposal\b|Plan\b|Migration plan\b|Acceptance criteria\b)/i
const GRANDFATHER = '<!-- agent-note-format: alternatives-not-recorded (pre-format Agent Note) -->'

interface Note { lifecycle: string; cls: string; date: string; rel: string }

function walkNotes(): Note[] {
  const notes: Note[] = []
  for (const lifecycle of LIFECYCLES) {
    for (const cls of CLASSES) {
      const dir = resolve(NOTES_ROOT, lifecycle, cls)
      if (!existsSync(dir)) continue
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md') || file.endsWith('.zh.md')) continue
        const match = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(file)
        if (!match) continue
        notes.push({ lifecycle, cls, date: match[1] ?? '', rel: `${lifecycle}/${cls}/${file}` })
      }
    }
  }
  return notes
}

const errors: string[] = []
const notes = walkNotes()

for (const note of notes) {
  const fail = (msg: string): void => { errors.push(`format: ${note.rel} — ${msg}`) }
  const lines = readFileSync(resolve(NOTES_ROOT, note.rel), 'utf8').split('\n')

  if (!/^# Agent Note: \S/.test(lines[0] ?? '')) fail('line 1 must be `# Agent Note: <title>`')
  if (lines[1] !== '') fail('line 2 must be blank')
  const status = STATUS[note.lifecycle]
  if (status !== undefined && !status.test(lines[2] ?? '')) {
    fail(`line 3 must match the ${note.lifecycle} status grammar`)
  }

  let inFence = false
  const prose = lines.filter((l) => {
    if (l.startsWith('```')) { inFence = !inFence; return false }
    return !inFence
  })
  const h2s = prose.filter(l => l.startsWith('## ')).map(l => l.trimEnd())
  if (h2s[0] !== '## Problem') fail(`the first section must be \`## Problem\``)
  for (const required of REQUIRED[note.lifecycle] ?? []) {
    if (!h2s.includes(required)) fail(`missing the required \`${required}\` section`)
  }
  if (note.lifecycle === 'implemented') {
    for (const h2 of h2s.filter(h => BANNED_IMPLEMENTED.test(h))) {
      fail(`\`${h2}\` is a proposal-era heading in an implemented Agent Note`)
    }
  }

  const hasSection = h2s.includes('## Alternatives considered')
  const hasGrandfather = prose.includes(GRANDFATHER)
  if (hasSection && hasGrandfather) fail('carries both the section and the grandfather comment')
  if (!hasSection && !hasGrandfather) fail('missing `## Alternatives considered`')
  if (hasGrandfather && note.date >= '2026-07-05') fail('grandfather comment only valid for pre-format notes')
}

if (errors.length === 0) {
  console.log(`verify-agent-note-format: ${notes.length} Agent Note(s) checked, all conform.`)
  process.exit(0)
}
console.error('verify-agent-note-format: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
