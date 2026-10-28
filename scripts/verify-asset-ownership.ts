/**
 * Enforce `docs/asset-ownership.json`: validate the manifest, require every
 * pattern to match at least one file, and reject paths claimed by two
 * categories. The console uses the same manifest to color graph nodes.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')

/** Repository-relative path of the machine-readable rules. */
const MANIFEST_PATH = 'docs/asset-ownership.json'

/** Closed set of asset categories. */
const CATEGORIES = ['framework', 'mixed', 'project'] as const

/** Directories that never take part in ownership classification. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'lib',
  'dist',
  'coverage',
  '.data',
  '.pnpm-store',
  'tmp',
  '.artifacts',
])

/** One asset category. */
type Category = (typeof CATEGORIES)[number]

/** One validated rule. */
interface Rule {
  readonly category: Category
  readonly patterns: readonly string[]
}

/** One validated manifest. */
interface Manifest {
  readonly version: number
  readonly default: Category
  readonly rules: readonly Rule[]
}

/** One compiled rule with its anchored expressions. */
interface CompiledRule {
  readonly category: Category
  readonly patterns: ReadonlyArray<{ readonly pattern: string; readonly expression: RegExp }>
}

/** Result of one ownership inspection. */
export interface AssetOwnershipReport {
  /** Number of files classified. */
  readonly files: number
  /** Number of compiled patterns. */
  readonly rules: number
  /** Files per category, including the default. */
  readonly counts: Readonly<Record<Category, number>>
  /** Validation problems; empty when the manifest is sound. */
  readonly errors: readonly string[]
}

/** Normalize one path to forward slashes without a leading `./`. */
export function normalizeOwnershipPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//u, '')
}

/**
 * Compile one ownership glob. `**` spans zero or more directories before `/`
 * and any characters otherwise; `*` and `?` stay inside one path segment.
 * @param pattern - repository-relative pattern.
 * @returns an anchored expression matching a whole path.
 */
export function ownershipPattern(pattern: string): RegExp {
  const normalized = normalizeOwnershipPath(pattern)
  let expression = ''
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index] ?? ''
    if (character === '*') {
      if (normalized[index + 1] === '*') {
        if (normalized[index + 2] === '/') {
          expression += '(?:[^/]+/)*'
          index += 2
        }
        else {
          expression += '.*'
          index += 1
        }
      }
      else {
        expression += '[^/]*'
      }
      continue
    }
    if (character === '?') {
      expression += '[^/]'
      continue
    }
    expression += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  }
  return new RegExp(`^${expression}$`, 'u')
}

/** Return an object-shaped value, or undefined for every other shape. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Whether one value is a known category. */
function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

/** Walk one repository, returning normalized relative file paths. */
function walkFiles(root: string): string[] {
  const files: string[] = []
  const visit = (directoryAbsolute: string, directoryRelative: string): void => {
    for (const entry of readdirSync(directoryAbsolute, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          visit(resolve(directoryAbsolute, entry.name), `${directoryRelative}/${entry.name}`)
        }
        continue
      }
      if (entry.isFile()) files.push(`${directoryRelative}/${entry.name}`)
    }
  }
  visit(root, '.')
  return files
    .map(path => normalizeOwnershipPath(path.slice(2)))
    .sort()
}

/** Parse and validate the manifest shape. */
function parseManifest(source: string): { manifest?: Manifest; errors: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  }
  catch (error) {
    return { errors: [`${MANIFEST_PATH}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const record = asRecord(parsed)
  if (record === undefined) return { errors: [`${MANIFEST_PATH}: expected a JSON object`] }

  const errors: string[] = []
  if (record.version !== 1) errors.push(`${MANIFEST_PATH}: version must be 1`)
  if (!isCategory(record.default)) errors.push(`${MANIFEST_PATH}: default must be one of ${CATEGORIES.join(', ')}`)

  const rawRules = record.rules
  if (!Array.isArray(rawRules)) {
    errors.push(`${MANIFEST_PATH}: rules must be an array`)
    return { errors }
  }

  const rules: Rule[] = []
  const seen = new Set<string>()
  rawRules.forEach((rawRule, ruleIndex) => {
    const rule = asRecord(rawRule)
    if (rule === undefined) {
      errors.push(`${MANIFEST_PATH}: rules[${String(ruleIndex)}] must be an object`)
      return
    }
    if (!isCategory(rule.category)) {
      errors.push(`${MANIFEST_PATH}: rules[${String(ruleIndex)}].category must be one of ${CATEGORIES.join(', ')}`)
      return
    }
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) {
      errors.push(`${MANIFEST_PATH}: rules[${String(ruleIndex)}].patterns must be a non-empty array`)
      return
    }
    const patterns: string[] = []
    for (const pattern of rule.patterns) {
      if (typeof pattern !== 'string' || pattern.trim() === '') {
        errors.push(`${MANIFEST_PATH}: rules[${String(ruleIndex)}].patterns must contain non-empty strings`)
        continue
      }
      if (seen.has(pattern)) errors.push(`${MANIFEST_PATH}: duplicate pattern ${JSON.stringify(pattern)}`)
      seen.add(pattern)
      patterns.push(pattern)
    }
    rules.push({ category: rule.category, patterns })
  })

  if (errors.length > 0) return { errors }
  return {
    manifest: {
      version: 1,
      default: record.default as Category,
      rules,
    },
    errors,
  }
}

/**
 * Inspect one repository's asset ownership rules.
 * @param root - repository root; defaults to this checkout.
 * @returns counts and every validation problem.
 */
export function inspectAssetOwnership(root: string = ROOT): AssetOwnershipReport {
  const errors: string[] = []
  let source: string
  try {
    source = readFileSync(resolve(root, MANIFEST_PATH), 'utf8')
  }
  catch (error) {
    return {
      files: 0,
      rules: 0,
      counts: { framework: 0, mixed: 0, project: 0 },
      errors: [`${MANIFEST_PATH}: cannot read the manifest: ${error instanceof Error ? error.message : String(error)}`],
    }
  }

  const parsed = parseManifest(source)
  errors.push(...parsed.errors)
  if (parsed.manifest === undefined) {
    return { files: 0, rules: 0, counts: { framework: 0, mixed: 0, project: 0 }, errors }
  }
  const manifest = parsed.manifest

  const files = walkFiles(root)
  const compiled = buildRules(manifest)

  for (const rule of compiled) {
    for (const { pattern, expression } of rule.patterns) {
      if (!files.some(path => expression.test(path))) {
        errors.push(`${MANIFEST_PATH}: pattern ${JSON.stringify(pattern)} (${rule.category}) matches no file`)
      }
    }
  }

  const counts: Record<Category, number> = { framework: 0, mixed: 0, project: 0 }
  const manifestCategory = classify(MANIFEST_PATH, compiled, manifest.default)
  if (manifestCategory !== 'framework') {
    errors.push(`${MANIFEST_PATH}: the manifest must classify itself as framework, got ${manifestCategory}`)
  }

  for (const path of files) {
    const matched = new Set<Category>()
    for (const rule of compiled) {
      if (rule.patterns.some(({ expression }) => expression.test(path))) matched.add(rule.category)
    }
    if (matched.size > 1) {
      errors.push(`${path}: claimed by multiple categories (${[...matched].join(', ')})`)
      continue
    }
    const category = matched.values().next().value ?? manifest.default
    counts[category] += 1
  }

  return {
    files: files.length,
    rules: compiled.reduce((total, rule) => total + rule.patterns.length, 0),
    counts,
    errors,
  }
}

/** Classify one path against the compiled rules. */
function classify(path: string, compiled: readonly CompiledRule[], fallback: Category): Category {
  for (const rule of compiled) {
    if (rule.patterns.some(({ expression }) => expression.test(path))) return rule.category
  }
  return fallback
}

/** Build compiled rules from one manifest. */
function buildRules(manifest: Manifest): CompiledRule[] {
  return manifest.rules.map(rule => ({
    category: rule.category,
    patterns: rule.patterns.map(pattern => ({ pattern, expression: ownershipPattern(pattern) })),
  }))
}

const entrypoint = process.argv[1]
if (entrypoint !== undefined && resolve(entrypoint) === fileURLToPath(import.meta.url)) {
  const report = inspectAssetOwnership()
  if (report.errors.length > 0) {
    process.stderr.write('verify-asset-ownership: violations found:\n')
    for (const error of report.errors) process.stderr.write(`  ${error}\n`)
    process.exitCode = 1
  }
  else {
    process.stdout.write(
      `verify-asset-ownership: ${String(report.files)} file(s), ${String(report.rules)} pattern(s); `
      + `framework ${String(report.counts.framework)}, mixed ${String(report.counts.mixed)}, project ${String(report.counts.project)}.\n`,
    )
  }
}
