/**
 * Read-only projection of the Agent Note tree: every file under
 * `.agents/notes/{lifecycle}/{class}/` plus the frozen archive. The reader
 * enforces the header and section grammar the note gates require, so a
 * malformed note surfaces as a failed read instead of disappearing.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import {
  ACTIVE_NOTE_LIFECYCLES,
  NOTE_CLASSES,
  agentNoteInsightSchema,
  type AgentNoteInsight,
  type NoteClass,
  type NoteLifecycle,
  type NoteSection,
} from './contracts.js'

/** Repository-relative root of the note tree. */
const NOTES_ROOT = '.agents/notes'

/** Date prefix every note filename carries. */
const NOTE_FILENAME = /^(\d{4}-\d{2}-\d{2})-.+\.md$/u

/** Level-two heading line inside a note body. */
const H2_HEADING = /^## (.+)$/u

/** First line of a note file. */
const NOTE_TITLE = /^# Agent Note: (.+)$/u

/** Seal-date line an archived note records below its status line. */
const ARCHIVED_DATE = /^Archived: (\d{4}-\d{2}-\d{2})$/u

/** Longest summary paragraph kept for the list view. */
const SUMMARY_MAX_LENGTH = 400

/** One note file discovered on disk. */
interface NoteFile {
  readonly absolutePath: string
  /** Repository-relative path with forward slashes. */
  readonly path: string
  readonly lifecycle: NoteLifecycle
  readonly noteClass: NoteClass
  readonly date: string
}

/** List matching note files in one directory; a missing directory is empty. */
function filesIn(
  repoRoot: string,
  directory: string,
  lifecycle: NoteLifecycle,
  noteClass: NoteClass,
): NoteFile[] {
  let names: string[]
  try {
    names = readdirSync(directory)
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }

  const files: NoteFile[] = []
  for (const name of names.sort()) {
    const date = NOTE_FILENAME.exec(name)?.[1]
    if (date === undefined) continue
    const absolutePath = resolve(directory, name)
    files.push({
      absolutePath,
      path: relative(repoRoot, absolutePath).split(sep).join('/'),
      lifecycle,
      noteClass,
      date,
    })
  }
  return files
}

/** Every note file in the active tree plus the archive. */
function noteFiles(repoRoot: string): NoteFile[] {
  const files: NoteFile[] = []
  for (const lifecycle of ACTIVE_NOTE_LIFECYCLES) {
    for (const noteClass of NOTE_CLASSES) {
      files.push(...filesIn(repoRoot, resolve(repoRoot, NOTES_ROOT, lifecycle, noteClass), lifecycle, noteClass))
    }
  }
  for (const noteClass of NOTE_CLASSES) {
    files.push(...filesIn(repoRoot, resolve(repoRoot, NOTES_ROOT, 'archived', noteClass), 'archived', noteClass))
  }
  return files
}

/** Read the one lifecycle a status line names, rejecting every other value. */
function parseStatus(line: string, path: string): 'proposed' | 'implemented' | 'rejected' {
  if (line === 'Status: proposed') return 'proposed'
  if (line === 'Status: implemented') return 'implemented'
  if (line.startsWith('Status: rejected — ')) return 'rejected'
  throw new Error(`${path}: line 3 must be a Status line for its lifecycle`)
}

/** Read the `Archived:` seal date an archived note must carry. */
function archivedDate(lines: readonly string[], path: string): string {
  for (const line of lines.slice(0, 8)) {
    const date = ARCHIVED_DATE.exec(line)?.[1]
    if (date !== undefined) return date
  }
  throw new Error(`${path}: an archived note must record \`Archived: <date>\``)
}

/** Split the body into `##` sections, ignoring heading-like lines inside fences. */
function parseSections(lines: readonly string[]): NoteSection[] {
  const sections: NoteSection[] = []
  let heading: string | undefined
  let body: string[] = []
  let inFence = false

  const flush = (): void => {
    if (heading !== undefined) sections.push({ heading, body: body.join('\n').trim() })
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence
      if (heading !== undefined) body.push(line)
      continue
    }
    if (!inFence) {
      const match = H2_HEADING.exec(line)
      if (match !== null) {
        flush()
        heading = match[1]?.trim() ?? ''
        body = []
        continue
      }
    }
    if (heading !== undefined) body.push(line)
  }
  flush()
  return sections
}

/** Keep the decision (or proposal) section first, then the first section available. */
function pickSummarySection(sections: readonly NoteSection[]): NoteSection | undefined {
  return sections.find(section => /^(?:Decision|Proposal)\b/u.test(section.heading)) ?? sections[0]
}

/** Reduce the first prose paragraph to a single plain-text line. */
function summarize(section: NoteSection | undefined): string {
  if (section === undefined) return ''
  const paragraph = section.body
    .split(/\n\s*\n/u)
    .map(part => part.trim())
    .find(part => part !== '' && !part.startsWith('|') && !part.startsWith('```'))
  if (paragraph === undefined) return ''
  const text = paragraph
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/[*`_]/gu, '')
    .replace(/^[-*] /u, '')
    .replace(/\s+/gu, ' ')
    .trim()
  return text.length > SUMMARY_MAX_LENGTH ? `${text.slice(0, SUMMARY_MAX_LENGTH).trimEnd()}…` : text
}

/** Parse one note file into its projection. */
function parseNote(file: NoteFile, source: string): AgentNoteInsight {
  const lines = source.split(/\r?\n/u)
  const title = NOTE_TITLE.exec(lines[0] ?? '')?.[1]?.trim()
  if (title === undefined || title === '') {
    throw new Error(`${file.path}: line 1 must be \`# Agent Note: <title>\``)
  }
  if (lines[1] !== '') throw new Error(`${file.path}: line 2 must be blank`)
  const status = parseStatus(lines[2] ?? '', file.path)
  if (lines[3] !== '') throw new Error(`${file.path}: line 4 must be blank`)
  const expected = file.lifecycle === 'archived' ? 'implemented' : file.lifecycle
  if (status !== expected) {
    throw new Error(`${file.path}: status "${status}" does not match the ${file.lifecycle} folder`)
  }

  const sections = parseSections(lines)
  const archivedOn = file.lifecycle === 'archived' ? archivedDate(lines, file.path) : undefined
  const base = {
    path: file.path,
    title,
    lifecycle: file.lifecycle,
    noteClass: file.noteClass,
    date: file.date,
    summary: summarize(pickSummarySection(sections)),
    sections,
  }
  return agentNoteInsightSchema.parse(archivedOn === undefined ? base : { ...base, archivedOn })
}

/**
 * Read and parse every Agent Note in the repository.
 *
 * @param repoRoot - repository root containing `.agents/notes`.
 * @returns notes sorted by date descending, then path.
 * @throws When a note deviates from the format the note gates enforce.
 */
export function readAgentNotes(repoRoot: string): AgentNoteInsight[] {
  return noteFiles(repoRoot)
    .map(file => parseNote(file, readFileSync(file.absolutePath, 'utf8')))
    .sort((left, right) => right.date.localeCompare(left.date) || left.path.localeCompare(right.path))
}
