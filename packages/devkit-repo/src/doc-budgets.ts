/**
 * Read-only projection of the documentation budgets: the manifest ceilings and
 * the current CJK-aware unit count of every budgeted file. The counting rule
 * mirrors `scripts/verify-doc-budgets.ts`; representative inputs are pinned in
 * the package tests so the two stay aligned.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { docBudgetInsightSchema, type DocBudgetInsight } from './contracts.js'

/** Repository-relative path of the ceiling manifest. */
const MANIFEST_PATH = 'scripts/doc-budgets.manifest.json'

/** CJK ranges counted one unit per character. */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/gu

/**
 * Count CJK characters plus whitespace-delimited non-CJK tokens.
 * @param text - document contents.
 * @returns the budget unit count.
 */
export function countUnits(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0
  const tokens = text.replace(CJK, ' ').split(/\s+/u).filter(Boolean).length
  return cjk + tokens
}

/** Return an object-shaped value, or undefined for every other shape. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/**
 * Read every documented budget with its current usage.
 *
 * @param repoRoot - repository root containing the manifest and the documents.
 * @returns budgets sorted by pressure (usage over ceiling) descending.
 * @throws When the manifest is malformed or a budgeted document is missing.
 */
export function readDocBudgets(repoRoot: string): DocBudgetInsight[] {
  const parsed: unknown = JSON.parse(readFileSync(resolve(repoRoot, MANIFEST_PATH), 'utf8'))
  const manifest = asRecord(parsed)
  if (manifest === undefined) throw new Error(`${MANIFEST_PATH}: expected a JSON object`)

  const budgets: DocBudgetInsight[] = []
  for (const [path, ceiling] of Object.entries(manifest)) {
    if (typeof ceiling !== 'number' || !Number.isInteger(ceiling) || ceiling <= 0) {
      throw new Error(`${MANIFEST_PATH}: ${path} needs a positive integer ceiling`)
    }
    const used = countUnits(readFileSync(resolve(repoRoot, path), 'utf8'))
    budgets.push(docBudgetInsightSchema.parse({ path, used, limit: ceiling }))
  }
  return budgets.sort((left, right) => right.used / right.limit - left.used / left.limit || left.path.localeCompare(right.path))
}
