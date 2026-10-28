/**
 * Compose the repository projections the health view reads. Every call re-reads
 * the files so the view tracks the working tree; a cache would add an owner and
 * a staleness rule without a current benefit.
 */

import type { Health } from './contracts.js'
import { readDocBudgets } from './doc-budgets.js'
import { readGates } from './gates.js'
import { readAgentNotes } from './notes.js'
import { readSkills } from './skills.js'

/**
 * Read every health projection for one repository.
 *
 * @param repoRoot - repository root the readers resolve against.
 * @returns notes, skills, documentation budgets, and the gate catalog.
 */
export function readHealth(repoRoot: string): Health {
  return {
    notes: readAgentNotes(repoRoot),
    skills: readSkills(repoRoot),
    budgets: readDocBudgets(repoRoot),
    gates: readGates(repoRoot),
  }
}
