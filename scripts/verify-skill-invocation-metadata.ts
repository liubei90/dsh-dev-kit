/**
 * Validate skill metadata under `.agents/skills/`, and keep the Claude Code and
 * Codex invocation policies aligned for skills that ship both.
 * @module scripts/verify-skill-invocation-metadata
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'

const ROOT = resolve(import.meta.dirname, '..')

/** Return an object-shaped YAML value, or undefined for every other shape. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Parse a skill's YAML frontmatter as an object. */
function parseSkillFrontmatter(source: string): Record<string, unknown> {
  const lines = source.split('\n')
  if (lines[0] !== '---') throw new Error('SKILL.md must start with YAML frontmatter')
  const end = lines.indexOf('---', 1)
  if (end < 0) throw new Error('SKILL.md frontmatter is not closed')
  const metadata = asRecord(load(lines.slice(1, end).join('\n')))
  if (metadata === undefined) throw new Error('SKILL.md frontmatter must be a YAML object')
  return metadata
}

/** List the repository skill directories, sorted by name. */
export function skillDirectories(root: string): string[] {
  const skillsRoot = resolve(root, '.agents/skills')
  if (!existsSync(skillsRoot)) return []
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}

/**
 * Report malformed skill metadata and cross-product invocation-policy mismatches.
 * @param root - Repository root containing `.agents/skills`.
 * @returns diagnostics for a missing skill file, frontmatter that disagrees with its directory,
 * or per-product invocation policies that expose the same skill differently.
 */
export function collectSkillInvocationMetadataViolations(root: string): string[] {
  const violations: string[] = []

  for (const skill of skillDirectories(root)) {
    const relativeRoot = `.agents/skills/${skill}`
    const skillFile = resolve(root, relativeRoot, 'SKILL.md')
    if (!existsSync(skillFile)) {
      violations.push(`${relativeRoot}: skill directory has no SKILL.md`)
      continue
    }

    let frontmatter: Record<string, unknown>
    try {
      frontmatter = parseSkillFrontmatter(readFileSync(skillFile, 'utf8'))
    }
    catch (error) {
      violations.push(`${relativeRoot}/SKILL.md: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    if (frontmatter.name !== skill) {
      violations.push(`${relativeRoot}/SKILL.md: name must match the directory, got ${JSON.stringify(frontmatter.name)}`)
    }
    if (typeof frontmatter.description !== 'string' || frontmatter.description.trim() === '') {
      violations.push(`${relativeRoot}/SKILL.md: description must be a non-empty string`)
    }

    const disableModelInvocation = frontmatter['disable-model-invocation']
    if (disableModelInvocation !== undefined && typeof disableModelInvocation !== 'boolean') {
      violations.push(`${relativeRoot}/SKILL.md: disable-model-invocation must be a boolean`)
      continue
    }
    const userInvocable = frontmatter['user-invocable']
    if (userInvocable !== undefined && typeof userInvocable !== 'boolean') {
      violations.push(`${relativeRoot}/SKILL.md: user-invocable must be a boolean`)
      continue
    }

    const openaiFile = resolve(root, relativeRoot, 'agents/openai.yaml')
    if (!existsSync(openaiFile)) continue

    let openai: Record<string, unknown>
    try {
      const parsed = asRecord(load(readFileSync(openaiFile, 'utf8')))
      if (parsed === undefined) throw new Error('agents/openai.yaml must be a YAML object')
      openai = parsed
    }
    catch (error) {
      violations.push(`${relativeRoot}/agents/openai.yaml: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    const policy = asRecord(openai.policy)
    const allowImplicitInvocation = policy?.allow_implicit_invocation
    if (allowImplicitInvocation !== undefined && typeof allowImplicitInvocation !== 'boolean') {
      violations.push(`${relativeRoot}/agents/openai.yaml: policy.allow_implicit_invocation must be a boolean`)
      continue
    }

    const claudeManualOnly = disableModelInvocation === true
    const codexManualOnly = allowImplicitInvocation === false
    if (claudeManualOnly !== codexManualOnly) {
      violations.push(
        `${relativeRoot}: Claude Code manual-only=${String(claudeManualOnly)}`
        + ` but Codex manual-only=${String(codexManualOnly)}`,
      )
    }
    if (claudeManualOnly && userInvocable === false) {
      violations.push(`${relativeRoot}/SKILL.md: a manual-only skill must remain user-invocable`)
    }
  }

  return violations
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const skills = skillDirectories(ROOT)
  const violations = collectSkillInvocationMetadataViolations(ROOT)
  if (violations.length > 0) {
    process.stderr.write('verify-skill-invocation-metadata: violations found:\n')
    for (const violation of violations) process.stderr.write(`  ${violation}\n`)
    process.exit(1)
  }

  process.stdout.write(`verify-skill-invocation-metadata: ${String(skills.length)} skill(s) checked.\n`)
}
