/**
 * Enforce Agent Note lifecycle/class paths and dated filenames. Structural rules
 * are shared with `agent-note-tree.ts`, which owns the single closed lifecycle and
 * class sets; the classification rules live in `.agents/notes/README.md`.
 */

import { AGENT_NOTE_CLASSES, AGENT_NOTE_LIFECYCLES, walkAgentNoteTree } from './agent-note-tree.ts'

const { notes, errors } = walkAgentNoteTree()

if (errors.length === 0) {
  console.log(`verify-agent-note-classification: ${notes.length} Agent Note(s) checked, structure consistent.`)
  process.exit(0)
}

console.error('verify-agent-note-classification: violations found:')
for (const error of errors) console.error(`  ${error}`)
console.error(`allowed lifecycles: ${AGENT_NOTE_LIFECYCLES.join(', ')}; allowed classes: ${AGENT_NOTE_CLASSES.join(', ')}`)
process.exit(1)
