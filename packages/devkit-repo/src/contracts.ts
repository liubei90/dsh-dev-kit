/**
 * Wire contracts for the read-only repository projections the reference console
 * renders. File-derived values are validated at the reader boundary; types come
 * from these schemas so the console, tests, and future consumers share one set.
 */

import { z } from 'zod'

/** One asset category from `docs/asset-ownership.md`. */
export const assetCategorySchema = z.enum(['framework', 'mixed', 'project'])

/** One asset category from `docs/asset-ownership.md`. */
export type AssetCategory = z.infer<typeof assetCategorySchema>

/** One ordered classification rule in `docs/asset-ownership.json`. */
export const assetOwnershipRuleSchema = z.object({
  category: assetCategorySchema,
  patterns: z.array(z.string().min(1)).min(1),
})

/** One ordered classification rule in `docs/asset-ownership.json`. */
export type AssetOwnershipRule = z.infer<typeof assetOwnershipRuleSchema>

/**
 * Machine-readable asset classification. Rules are checked in file order and
 * the first match wins; `default` covers every unlisted path.
 */
export const assetOwnershipManifestSchema = z.object({
  version: z.literal(1),
  default: assetCategorySchema,
  rules: z.array(assetOwnershipRuleSchema),
})

/** Machine-readable asset classification shared by the console and its gate. */
export type AssetOwnershipManifest = z.infer<typeof assetOwnershipManifestSchema>

/** Active Agent Note lifecycles, matching the classification gate's closed set. */
export const ACTIVE_NOTE_LIFECYCLES = ['proposed', 'implemented', 'rejected'] as const

/** Every Agent Note lifecycle, including the frozen archive. */
export const NOTE_LIFECYCLES = [...ACTIVE_NOTE_LIFECYCLES, 'archived'] as const

/** Closed set of Agent Note classes. */
export const NOTE_CLASSES = ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'] as const

/** Where an Agent Note sits in its lifecycle. */
export const noteLifecycleSchema = z.enum(NOTE_LIFECYCLES)

/** Where an Agent Note sits in its lifecycle. */
export type NoteLifecycle = z.infer<typeof noteLifecycleSchema>

/** Category of decision an Agent Note records. */
export const noteClassSchema = z.enum(NOTE_CLASSES)

/** Category of decision an Agent Note records. */
export type NoteClass = z.infer<typeof noteClassSchema>

/** One `##` section of an Agent Note, with its body kept as plain Markdown text. */
export const noteSectionSchema = z.object({
  heading: z.string().min(1),
  body: z.string(),
})

/** One `##` section of an Agent Note. */
export type NoteSection = z.infer<typeof noteSectionSchema>

/** A read-only projection of one Agent Note file. */
export const agentNoteInsightSchema = z.object({
  /** Repository-relative path of the note. */
  path: z.string().min(1),
  title: z.string().min(1),
  lifecycle: noteLifecycleSchema,
  noteClass: noteClassSchema,
  /** Date the topic was first proposed, from the filename. */
  date: z.iso.date(),
  /** Seal date of an archived note; absent for active notes. */
  archivedOn: z.iso.date().optional(),
  /** First paragraph of the decision or proposal section. */
  summary: z.string(),
  /** Every `##` section, in file order. */
  sections: z.array(noteSectionSchema),
})

/** A read-only projection of one Agent Note file. */
export type AgentNoteInsight = z.infer<typeof agentNoteInsightSchema>

/** A repository skill discovered from its `SKILL.md` front matter. */
export const skillInsightSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  /** Repository-relative path of the skill file. */
  path: z.string().min(1),
})

/** A repository skill discovered from its `SKILL.md` front matter. */
export type SkillInsight = z.infer<typeof skillInsightSchema>

/** Current word-unit usage of one budgeted document. */
export const docBudgetInsightSchema = z.object({
  /** Repository-relative path of the document. */
  path: z.string().min(1),
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
})

/** Current word-unit usage of one budgeted document. */
export type DocBudgetInsight = z.infer<typeof docBudgetInsightSchema>

/** One quality-gate command declared by the root package manifest. */
export const gateInsightSchema = z.object({
  /** Script name, as declared in `package.json`. */
  script: z.string().min(1),
  /** Command the script runs. */
  command: z.string().min(1),
})

/** One quality-gate command declared by the root package manifest. */
export type GateInsight = z.infer<typeof gateInsightSchema>

/** Everything the health view displays in one response. */
export const healthSchema = z.object({
  notes: z.array(agentNoteInsightSchema),
  skills: z.array(skillInsightSchema),
  budgets: z.array(docBudgetInsightSchema),
  gates: z.array(gateInsightSchema),
})

/** Everything the health view displays in one response. */
export type Health = z.infer<typeof healthSchema>

/** Kind of repository artifact a graph node represents. */
export const graphNodeKindSchema = z.enum(['note', 'doc', 'skill'])

/** Kind of repository artifact a graph node represents. */
export type GraphNodeKind = z.infer<typeof graphNodeKindSchema>

/** One node of the repository knowledge graph. */
export const graphNodeSchema = z.object({
  /** Repository-relative path, also the node id. */
  id: z.string().min(1),
  kind: graphNodeKindSchema,
  title: z.string().min(1),
  /** Present on note nodes only. */
  noteClass: noteClassSchema.optional(),
  /** Present on note nodes only. */
  lifecycle: noteLifecycleSchema.optional(),
  /** Asset category the path belongs to. */
  ownership: assetCategorySchema,
  /** Number of distinct edges touching this node. */
  degree: z.number().int().nonnegative(),
})

/** One node of the repository knowledge graph. */
export type GraphNode = z.infer<typeof graphNodeSchema>

/** One directed link between two graph nodes. */
export const graphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

/** One directed link between two graph nodes. */
export type GraphEdge = z.infer<typeof graphEdgeSchema>

/** Nodes and links the knowledge graph view renders. */
export const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
})

/** Nodes and links the knowledge graph view renders. */
export type Graph = z.infer<typeof graphSchema>

/** Lifecycle of one gate run. */
export const gateRunStatusSchema = z.enum(['running', 'success', 'failed', 'timeout', 'error'])

/** Lifecycle of one gate run. */
export type GateRunStatus = z.infer<typeof gateRunStatusSchema>

/** One gate execution owned by the console process. */
export const gateRunSchema = z.object({
  id: z.string().min(1),
  script: z.string().min(1),
  command: z.string().min(1),
  status: gateRunStatusSchema,
  /** ISO timestamp when the run started. */
  startedAt: z.iso.datetime(),
  /** ISO timestamp when the run settled; absent while running. */
  finishedAt: z.iso.datetime().optional(),
  /** Wall-clock duration in milliseconds; absent while running. */
  durationMs: z.number().int().nonnegative().optional(),
  /** Exit code when the process exited; null while running or after a signal. */
  exitCode: z.number().int().nullable(),
  /** Captured standard output, truncated at the runner's cap. */
  stdout: z.string(),
  /** Captured standard error, truncated at the runner's cap. */
  stderr: z.string(),
  /** True when either captured stream hit the cap. */
  truncated: z.boolean(),
})

/** One gate execution owned by the console process. */
export type GateRun = z.infer<typeof gateRunSchema>

/** The gate catalog and the runs the console still remembers. */
export const gateOverviewSchema = z.object({
  gates: z.array(gateInsightSchema),
  runs: z.array(gateRunSchema),
})

/** The gate catalog and the runs the console still remembers. */
export type GateOverview = z.infer<typeof gateOverviewSchema>
