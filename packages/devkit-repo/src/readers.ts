/**
 * Node-side readers for the repository projections. Import this entry from a
 * server process; the package root stays browser-safe and exports only contracts.
 */

export { countUnits, readDocBudgets } from './doc-budgets.js'
export { GATE_SCRIPT_NAMES, isGateScript, readGates } from './gates.js'
export { readGraph } from './graph.js'
export { readHealth } from './health.js'
export { readAgentNotes } from './notes.js'
export {
  ASSET_OWNERSHIP_PATH,
  createOwnershipResolver,
  globToRegExp,
  loadOwnershipManifest,
  loadOwnershipResolver,
  normalizeRepoPath,
} from './ownership.js'
export type { OwnershipResolver } from './ownership.js'
export { readSkills } from './skills.js'
