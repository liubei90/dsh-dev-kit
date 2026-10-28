/**
 * Read-only projection of the skill catalog: every directory under
 * `.agents/skills/` that holds a `SKILL.md`, with the name and description from
 * its YAML front matter.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skillInsightSchema, type SkillInsight } from './contracts.js'

/** Repository-relative root of the skill catalog. */
const SKILLS_ROOT = '.agents/skills'

/** One `key: value` line in simple front matter. */
const FRONT_MATTER_KEY = /^([A-Za-z][\w-]*):\s*(.*)$/u

/** Strip one pair of matching single or double quotes. */
function unquote(value: string): string {
  const quoted = value.length >= 2
    && ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))
  return quoted ? value.slice(1, -1) : value
}

/** Parse the one-line YAML front matter keys the skill gate requires. */
function frontMatter(source: string, path: string): Record<string, string> {
  const lines = source.split(/\r?\n/u)
  if (lines[0] !== '---') throw new Error(`${path}: must start with YAML front matter`)
  const end = lines.indexOf('---', 1)
  if (end < 0) throw new Error(`${path}: front matter is not closed`)

  const metadata: Record<string, string> = {}
  for (const line of lines.slice(1, end)) {
    const match = FRONT_MATTER_KEY.exec(line)
    const key = match?.[1]
    const value = match?.[2]
    if (key !== undefined && value !== undefined) metadata[key] = unquote(value.trim())
  }
  return metadata
}

/**
 * Read every skill in the catalog.
 *
 * @param repoRoot - repository root containing `.agents/skills`.
 * @returns skills sorted by directory name; a repository without the catalog has none.
 * @throws When a `SKILL.md` has malformed front matter.
 */
export function readSkills(repoRoot: string): SkillInsight[] {
  const root = resolve(repoRoot, SKILLS_ROOT)
  if (!existsSync(root)) return []

  const names = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  const skills: SkillInsight[] = []
  for (const name of names) {
    const relativePath = `${SKILLS_ROOT}/${name}/SKILL.md`
    const absolutePath = resolve(root, name, 'SKILL.md')
    if (!existsSync(absolutePath)) continue
    const metadata = frontMatter(readFileSync(absolutePath, 'utf8'), relativePath)
    skills.push(skillInsightSchema.parse({
      name: metadata.name ?? name,
      description: metadata.description ?? '',
      path: relativePath,
    }))
  }
  return skills
}
