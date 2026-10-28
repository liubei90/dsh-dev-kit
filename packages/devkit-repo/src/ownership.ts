/**
 * Asset classification: read `docs/asset-ownership.json`, compile its ordered
 * patterns, and classify repository-relative paths. The first matching rule
 * wins; unlisted paths use the manifest default.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assetOwnershipManifestSchema,
  type AssetCategory,
  type AssetOwnershipManifest,
} from './contracts.js'

/** Repository-relative path of the machine-readable classification rules. */
export const ASSET_OWNERSHIP_PATH = 'docs/asset-ownership.json'

/** One compiled classification rule. */
interface CompiledRule {
  readonly category: AssetCategory
  readonly patterns: readonly RegExp[]
}

/** Classifies repository-relative paths against one manifest. */
export interface OwnershipResolver {
  /**
   * Classify one repository-relative path.
   * @param path - path using either separator.
   * @returns the first matching rule's category, else the manifest default.
   */
  classify(path: string): AssetCategory
}

/**
 * Normalize one repository-relative path to forward slashes without a leading `./`.
 * @param path - path using either separator.
 * @returns the normalized path.
 */
export function normalizeRepoPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//u, '')
}

/**
 * Compile one ownership glob. `**` spans zero or more directories when it is
 * followed by `/`, otherwise it spans any characters; `*` and `?` stay inside
 * one path segment; every other character is literal.
 * @param pattern - repository-relative pattern from the manifest.
 * @returns an anchored expression matching a whole path.
 */
export function globToRegExp(pattern: string): RegExp {
  const normalized = normalizeRepoPath(pattern)
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

/**
 * Read and validate the explicit ownership manifest.
 *
 * @param repoRoot - repository root containing `docs/asset-ownership.json`.
 * @returns the parsed manifest.
 * @throws When the file is missing, not JSON, or does not match the schema.
 */
export function loadOwnershipManifest(repoRoot: string): AssetOwnershipManifest {
  const absolute = resolve(repoRoot, ASSET_OWNERSHIP_PATH)
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(absolute, 'utf8'))
  }
  catch (error) {
    throw new Error(`${ASSET_OWNERSHIP_PATH}: cannot read the manifest: ${error instanceof Error ? error.message : String(error)}`)
  }
  const result = assetOwnershipManifestSchema.safeParse(parsed)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue === undefined ? 'manifest' : `${issue.path.join('.') || 'manifest'}: ${issue.message}`
    throw new Error(`${ASSET_OWNERSHIP_PATH}: ${where}`)
  }
  return result.data
}

/**
 * Compile one manifest into a resolver owned by the caller.
 *
 * @param manifest - validated classification manifest.
 * @returns a resolver whose `classify` applies the ordered rules.
 */
export function createOwnershipResolver(manifest: AssetOwnershipManifest): OwnershipResolver {
  const rules: CompiledRule[] = manifest.rules.map(rule => ({
    category: rule.category,
    patterns: rule.patterns.map(pattern => globToRegExp(pattern)),
  }))
  return {
    classify(path: string): AssetCategory {
      const normalized = normalizeRepoPath(path)
      for (const rule of rules) {
        if (rule.patterns.some(expression => expression.test(normalized))) return rule.category
      }
      return manifest.default
    },
  }
}

/**
 * Read the manifest and compile it in one step.
 *
 * @param repoRoot - repository root containing `docs/asset-ownership.json`.
 * @returns a resolver owned by the caller.
 */
export function loadOwnershipResolver(repoRoot: string): OwnershipResolver {
  return createOwnershipResolver(loadOwnershipManifest(repoRoot))
}
